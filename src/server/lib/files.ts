import { readFile, writeFile } from "node:fs/promises"
import { Readable, Writable } from "node:stream"
import crypto from "node:crypto"
import { files } from "./accounts"
import { Client as API } from "./DiscordAPI"
import type {APIAttachment} from "discord-api-types/v10"

import * as Accounts from "./accounts"

export let id_check_regex = /[A-Za-z0-9_\-\.\!\=\:\&\$\,\+\;\@\~\*\(\)\']+/
export let alphanum = Array.from(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
)

require("dotenv").config()

// bad solution but whatever

export type FileVisibility = "public" | "anonymous" | "private"

/**
 * @description Generates an alphanumeric string, used for files
 * @param length Length of the ID
 * @returns a random alphanumeric string
 */
export function generateFileId(length: number = 5) {
    let fid = ""
    for (let i = 0; i < length; i++) {
        fid += alphanum[crypto.randomInt(0, alphanum.length)]
    }
    return fid
}

/**
 * @description Assert multiple conditions... this exists out of pure laziness
 * @param conditions 
 */

function multiAssert(conditions: Map<boolean, { message: string, status: number }>) {
    for (let [cond, err] of conditions.entries()) {
        if (cond) return err
    }
}

export type FileUploadSettings = Partial<Pick<FilePointer, "mime" | "owner">> &
    Pick<FilePointer, "mime" | "filename"> & { uploadId?: string }

export interface Configuration {
    maxDiscordFiles: number
    maxDiscordFileSize: number
    targetGuild: string
    targetChannel: string
    requestTimeout: number
    maxUploadIdLength: number

    accounts: {
        registrationEnabled: boolean
        requiredForUpload: boolean
    }

    trustProxy: boolean
    forceSSL: boolean
}

export interface FilePointer {
    filename: string
    mime: string
    messageids: string[]
    owner?: string
    sizeInBytes?: number
    tag?: string
    visibility?: FileVisibility
    reserved?: boolean
    chunkSize?: number
}

export interface StatusCodeError {
    status: number
    message: string
}

/**
 * @description This function does not respect backpressure and should be worked out of the codebase. Superseded by startPushingWebStream()
 */

async function pushWebStream(stream: Readable, webStream: ReadableStream) {
    const reader = await webStream.getReader()
    let result: Awaited<ReturnType<typeof reader.read>> = { done: false, value: undefined }
    let last = true

    while ( !result.done ) {
        result = await reader.read()
        last = stream.push(result.value)
    }
    return last
}

async function startPushingWebStream(stream: Readable, webStream: ReadableStream) {
    const reader = await webStream.getReader()
    let pushing = false // acts as a debounce just in case
                          // (words of a girl paranoid from writing readfilestream)

    return function() {
        if (pushing) return
        pushing = true

        return reader.read().then(result => {
            if (result.value)
                stream.push(result.value)
            pushing = false
            return result.done
        })
    }
}

namespace StreamHelpers {

    export interface UploadStream {
        uploaded: number // number of bytes uploaded
        stream  : Readable
    }

    export class StreamBuffer {

        readonly targetSize: number
        filled: number = 0
        buffer: UploadStream[] = []
        messages: string[] = []
        
        private newmessage_debounce : boolean = true

        api: API

        constructor( api: API, targetSize: number ) {
            this.api = api
            this.targetSize = targetSize
        }

        private async startMessage(streamCount: number): Promise<UploadStream[] | undefined> {

            if (!this.newmessage_debounce) return
            this.newmessage_debounce = false
        
            let streams = []
    
            // can't think of a better way to do
            for (let i = 0; i < streamCount; i++) {
                streams.push({
                    uploaded: 0,
                    stream: new Readable({})
                })
            }
    
            let message = await this.api.send(streams.map(e => e.stream));
            this.messages.push(message.id)
            this.newmessage_debounce = true
    
            return streams
            
        }

        async getNextStream() {
            if (this.buffer[0]) return this.buffer[0]
            else {
                // startmessage.... idk
            }
        }

    }

}

export default class Files {
    config: Configuration
    api: API
    files: { [key: string]: FilePointer } = {}

    constructor(config: Configuration) {
        this.config = config
        this.api = new API(process.env.TOKEN!, config.targetChannel)

        readFile(process.cwd() + "/.data/files.json")
            .then((buf) => {
                this.files = JSON.parse(buf.toString() || "{}")
            })
            .catch(console.error)
    }

    validateUpload(metadata: FileUploadSettings & { size : number, uploadId: string }) {
        return multiAssert(
            new Map()
                .set(!metadata.filename, {status: 400, message: "missing filename"})
                .set(metadata.filename.length > 128, {status: 400, message: "filename too long"})
                .set(!metadata.mime, {status: 400, message: "missing mime type"})
                .set(metadata.mime.length > 128, {status: 400, message: "mime type too long"})
                .set(
                    metadata.uploadId.match(id_check_regex)?.[0] != metadata.uploadId
                    || metadata.uploadId.length > this.config.maxUploadIdLength,
                    { status: 400, message: "invalid file ID" }
                )
                .set(
                    this.files[metadata.uploadId] &&
                    (metadata.owner
                        ? this.files[metadata.uploadId].owner != metadata.owner
                        : true),
                    { status: 403, message: "you don't own this file" }
                )
                .set(
                    this.files[metadata.uploadId]?.reserved,
                    {
                        status: 400,
                        message: "already uploading this file. if your file is stuck in this state, contact an administrator"
                    }
                )
        )
    }

    writeFileStream(metadata: FileUploadSettings & { size: number }) {

        let uploadId = (metadata.uploadId || generateFileId()).toString()
        
        let validation = this.validateUpload(
            {...metadata, uploadId}
        )
        if (validation) return validation

        let buf = new StreamHelpers.StreamBuffer(this.api, metadata.size)
        let fs_obj = this

        return new Writable({
            async write(data: Buffer) {
                let positionInBuf = 0
                while (positionInBuf < data.byteLength) {
                    let ns = (await buf.getNextStream().catch(e => {

                        return e
                    }))
                    if (!ns || ns instanceof Error) {
                        this.destroy(ns)
                        return
                    }

                    let bytesToPush = Math.min(
                        data.byteLength, 
                        fs_obj.config.maxDiscordFileSize-ns.uploaded
                    )

                    ns.stream.push(data.subarray(positionInBuf, positionInBuf + bytesToPush))
                    ns.uploaded += bytesToPush
                    buf.filled += bytesToPush
                    positionInBuf += bytesToPush

                    if (ns.uploaded == fs_obj.config.maxDiscordFileSize) 
                        buf.buffer.splice(0, 1)[0]?.stream.destroy()
                    
                    if (buf.filled == buf.targetSize) {
                        this.destroy()
                        return
                    }
                }
            }
        })

    }

    /**
     * @description Uploads a new file
     * @param metadata Settings for your new upload
     * @param buffer Buffer containing file content
     * @returns Promise which resolves to the ID of the new file
     */
    async uploadFile(
        metadata: FileUploadSettings,
        buffer: Buffer
    ): Promise<string | StatusCodeError> {

        if (!metadata.filename || !metadata.mime)
            throw { status: 400, message: "missing filename/mime" }

        let uploadId = (metadata.uploadId || generateFileId()).toString()

        if (
            (uploadId.match(id_check_regex) || [])[0] != uploadId ||
            uploadId.length > this.config.maxUploadIdLength
        )
            throw { status: 400, message: "invalid id" }

        if (
            this.files[uploadId] &&
            (metadata.owner
                ? this.files[uploadId].owner != metadata.owner
                : true)
        )
            throw {
                status: 400,
                message: "you are not the owner of this file id",
            }

        if (this.files[uploadId] && this.files[uploadId].reserved)
            throw {
                status: 400,
                message:
                    "already uploading this file. if your file is stuck in this state, contact an administrator",
            }

        if (metadata.filename.length > 128)
            throw { status: 400, message: "name too long" }

        if (metadata.mime.length > 128)
            throw { status: 400, message: "mime too long" }

        // reserve file, hopefully should prevent
        // large files breaking

        let existingFile = this.files[uploadId]

        // save

        if (metadata.owner) {
            await files.index(metadata.owner, uploadId)
        }

        // get buffer
        if (
            buffer.byteLength >=
            this.config.maxDiscordFileSize * this.config.maxDiscordFiles
        )
            throw { status: 400, message: "file too large" }

        // generate buffers to upload
        let toUpload = []
        for (
            let i = 0;
            i < Math.ceil(buffer.byteLength / this.config.maxDiscordFileSize);
            i++
        ) {
            toUpload.push(
                buffer.subarray(
                    i * this.config.maxDiscordFileSize,
                    Math.min(
                        buffer.byteLength,
                        (i + 1) * this.config.maxDiscordFileSize
                    )
                )
            )
        }

        // begin uploading
        let uploadGroups = []

        for (let i = 0; i < Math.ceil(toUpload.length / 10); i++) {
            uploadGroups.push(toUpload.slice(i * 10, (i + 1) * 10))
        }

        let msgIds = []

        for (const uploadGroup of uploadGroups) {
            let message = await this.api.send(uploadGroup)

            if (message) {
                msgIds.push(message.id)
            } else {
                if (!existingFile) delete this.files[uploadId]
                else this.files[uploadId] = existingFile
                throw { status: 500, message: "please try again" }
            }
        }

        if (existingFile) this.api.deleteMessages(existingFile.messageids)

        const { filename, mime, owner } = metadata

        this.files[uploadId] = {
            filename,
            messageids: msgIds,
            mime,
            owner,
            sizeInBytes: buffer.byteLength,

            visibility: existingFile
                ? existingFile.visibility
                : metadata.owner
                ? Accounts.getFromId(metadata.owner)?.defaultFileVisibility
                : undefined,
            // so that json.stringify doesnt include tag:undefined
            ...((existingFile || {}).tag ? { tag: existingFile.tag } : {}),

            chunkSize: this.config.maxDiscordFileSize,
        }

        return this.write().then(_ => uploadId).catch(_ => {
            delete this.files[uploadId]
            throw { status: 500, message: "failed to save database" }
        })
    }

    // fs

    /**
     * @description Saves file database
     * 
     */
    async write(): Promise<void> {
        await writeFile(
            process.cwd() + "/.data/files.json",
            JSON.stringify(
                this.files,
                null,
                process.env.NODE_ENV === "development" ? 4 : undefined
            )
        )
    }

    /**
     * @description Update a file from monofile 1.2 to allow for range requests with Content-Length to that file.
     * @param uploadId Target file's ID
     */

    async update( uploadId: string ) {
        let target_file = this.files[uploadId]
        let attachment_sizes = []

        for (let message of target_file.messageids) {
            let attachments = (await this.api.fetchMessage(message)).attachments
            for (let attachment of attachments) {
                attachment_sizes.push(attachment.size)
            }
        }

        if (!target_file.sizeInBytes)
            target_file.sizeInBytes = attachment_sizes.reduce((a, b) => a + b, 0) 
        
        if (!target_file.chunkSize)
            target_file.chunkSize = attachment_sizes[0]

        
    }

    /**
     * @description Read a file
     * @param uploadId Target file's ID
     * @param range Byte range to get
     * @returns A {@link Readable} containing the file's contents
     */
    async readFileStream(
        uploadId: string,
        range?: { start: number; end: number }
    ): Promise<Readable> {
        if (this.files[uploadId]) {
            let file = this.files[uploadId]
            if (!file.sizeInBytes || !file.chunkSize) await this.update(uploadId)

            let scan_msg_begin = 0,
                scan_msg_end = file.messageids.length - 1,
                scan_files_begin = 0,
                scan_files_end = -1

            let useRanges = range && file.chunkSize && file.sizeInBytes

            // todo: figure out how to get typesccript to accept useRanges
            // i'm too tired to look it up or write whatever it wnats me to do
            if (range && file.chunkSize && file.sizeInBytes) {
                // Calculate where to start file scans...

                scan_files_begin = Math.floor(range.start / file.chunkSize)
                scan_files_end = Math.ceil(range.end / file.chunkSize) - 1

                scan_msg_begin = Math.floor(scan_files_begin / 10)
                scan_msg_end = Math.ceil(scan_files_end / 10)
            }

            let attachments: APIAttachment[] = []

            let msgIdx = scan_msg_begin

            let getNextAttachment = async () => {
                // return first in our attachment buffer
                let ret = attachments.splice(0,1)[0]
                if (ret) return ret

                // oh, there's none left. let's fetch a new message, then.
                if (!file.messageids[msgIdx]) return null
                let msg = await this.api
                    .fetchMessage(file.messageids[msgIdx])
                    .catch(() => {
                        return null
                    })

                if (msg?.attachments) {
                    let attach = Array.from(msg.attachments.values())
                    for (
                        let i =
                        
                            useRanges && msgIdx == scan_msg_begin
                                ? scan_files_begin - msgIdx * 10
                                : 0;
                        i <
                        (useRanges && msgIdx == scan_msg_end
                            ? scan_files_end - msgIdx * 10 + 1
                            : attach.length);
                        i++
                    ) {
                        attachments.push(attach[i])
                    }
                }

                msgIdx++
                return attachments.splice(0,1)[0]
            }

            let position = 0

            let getNextChunk = async () => {
                let scanning_chunk = await getNextAttachment()
                if (!scanning_chunk) {
                    return null
                }

                let headers: HeadersInit =
                    useRanges
                        ? {
                            Range: `bytes=${
                                // If this is the first chunk of the file (position == 0)
                                // and both 'range' and 'file.chunkSize' are defined,
                                // calculate the start of the range.
                                // Otherwise, default to "0".
                                position == 0 && range 
                                && file.chunkSize
                                    ? range.start - scan_files_begin * file.chunkSize
                                    : "0"
                            }-${
                                // If this is the last chunk of the file (position == attachments.length - 1)
                                // and both 'range' and 'file.chunkSize' are defined,
                                // calculate the end of the range.
                                // Otherwise, default to an empty string.
                                position == attachments.length - 1 && range 
                                && file.chunkSize
                                    ? range.end - scan_files_end * file.chunkSize
                                    : ""
                            }`,
                          }
                        : {}

                let d = await fetch(scanning_chunk.url, {headers})
                    .catch((e: Error) => {
                        console.error(e)
                        return {body: "__ERR"}
                    })

                position++

                return d.body
            }

            let ord: number[] = []
            // hopefully this regulates it?
            let lastChunkSent = true

            let dataStream = new Readable({
                read() {
                    if (!lastChunkSent) return
                    lastChunkSent = false
                    getNextChunk().then(async (nextChunk) => {
                        if (typeof nextChunk == "string") {
                            this.destroy(new Error("file read error"))
                            return
                        }

                        if (!nextChunk) return // EOF

                        let response = await pushWebStream(this, nextChunk)


                        while (response) {
                            let nextChunk = await getNextChunk()
                            // idk why this line was below but i moved it on top
                            // hopefully it wasn't for some other weird reason
                            if (!nextChunk || typeof nextChunk == "string") return
                            response = await pushWebStream(this, nextChunk)
                        }
                        lastChunkSent = true
                    })
                },
            })

            return dataStream
        } else {
            throw { status: 404, message: "not found" }
        }
    }

    /**
     * @description Deletes a file
     * @param uploadId Target file's ID
     * @param noWrite Whether or not the change should be written to disk. Enable for bulk deletes
     */
    async unlink(uploadId: string, noWrite: boolean = false): Promise<void> {
        let target = this.files[uploadId]
        if (!target) return
        if (target.owner) {
            let id = files.deindex(target.owner, uploadId, noWrite)
            if (id) await id
        }

        await this.api.deleteMessages(target.messageids)

        delete this.files[uploadId]
        if (noWrite) return
        return this.write().catch((err) => {
            throw err
        })
    }

}
