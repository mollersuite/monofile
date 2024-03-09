import { readFile, writeFile } from "node:fs/promises"
import { Readable, Writable } from "node:stream"
import crypto from "node:crypto"
import { files } from "./accounts.js"
import { Client as API } from "./DiscordAPI/index.js"
import type {APIAttachment} from "discord-api-types/v10"
import "dotenv/config"

import * as Accounts from "./accounts.js"

export let id_check_regex = /[A-Za-z0-9_\-\.\!\=\:\&\$\,\+\;\@\~\*\(\)\']+/
export let alphanum = Array.from(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
)

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

export class WebError extends Error {

    readonly statusCode: number = 500
    
    constructor(status: number, message: string) {
        super(message)
        this.statusCode = status
    }

}

export class ReadStream extends Readable {

    files: Files
    pointer: FilePointer

    attachmentBuffer: APIAttachment[] = []
    msgIdx: number = 0
    position: number = 0

    ranges: {
        useRanges: boolean,
        byteStart: number,
        byteEnd: number
        scan_msg_begin: number,
        scan_msg_end: number,
        scan_files_begin: number,
        scan_files_end: number
    }

    id: number = Math.random()
    aborter?: AbortController

    constructor(files: Files, pointer: FilePointer, range?: {start: number, end: number}) {
        super()
        console.log(this.id, range)
        this.files = files
        this.pointer = pointer

        let useRanges = 
            Boolean(range && pointer.chunkSize && pointer.sizeInBytes)
        
        this.ranges = {
            useRanges,
            scan_msg_begin: 0,
            scan_msg_end: pointer.messageids.length - 1,
            scan_files_begin: 
                useRanges
                ? Math.floor(range!.start / pointer.chunkSize!)
                : 0,
            scan_files_end: 
                useRanges
                ? Math.ceil(range!.end / pointer.chunkSize!) - 1
                : -1,
            byteStart: range?.start || 0,
            byteEnd: range?.end || 0
        }

        if (useRanges)
            this.ranges.scan_msg_begin = Math.floor(this.ranges.scan_files_begin / 10),
            this.ranges.scan_msg_end = Math.ceil(this.ranges.scan_files_end / 10)-1,
            this.msgIdx = this.ranges.scan_msg_begin
    }

    async _read() {/*
        console.log("Calling for more data")
        if (this.busy) return
        this.busy = true
        let readyForMore = true

        while (readyForMore) {
            let result = await this.pushData()
            if (result === undefined) return // stream has been destroyed. nothing left to do...
            readyForMore = result
        }
        this.busy = false*/
        this.pushData()
    }

    async _destroy(error: Error | null, callback: (error?: Error | null | undefined) => void): Promise<void> {
        if (this.aborter)
            this.aborter.abort()
        callback()
    }

    async getNextAttachment() {
        // return first in our attachment buffer
        let ret = this.attachmentBuffer.splice(0,1)[0]
        if (ret) return ret

        console.log(this.id, this.msgIdx, this.ranges.scan_msg_end, this.pointer.messageids[this.msgIdx])

        // oh, there's none left. let's fetch a new message, then.
        if (
            !this.pointer.messageids[this.msgIdx] 
            || this.msgIdx > this.ranges.scan_msg_end
        ) return null

        let msg = await this.files.api
            .fetchMessage(this.pointer.messageids[this.msgIdx])
            .catch((e) => {
                console.error(e)
                return null
            })

        if (msg?.attachments) {
            let attach = msg.attachments
            console.log(attach)

            this.attachmentBuffer = this.ranges.useRanges ? attach.slice(
                this.msgIdx == this.ranges.scan_msg_begin
                        ? this.ranges.scan_files_begin - this.ranges.scan_msg_begin * 10
                    : 0,
                this.msgIdx == this.ranges.scan_msg_end
                    ? this.ranges.scan_files_end - this.ranges.scan_msg_end * 10 + 1
                    : attach.length
            ) : attach

            console.log(this.attachmentBuffer)
        }

        this.msgIdx++
        return this.attachmentBuffer.splice(0,1)[0]
    }

    async getPusherForWebStream(webStream: ReadableStream) {
        const reader = await webStream.getReader()
        let pushing = false // acts as a debounce just in case
                            // (words of a girl paranoid from writing readfilestream)

        let pushToStream = this.push.bind(this)
        let stream = this
        
        return function() {
            if (pushing) return
            pushing = true

            return reader.read().catch(e => {
                // Probably means an AbortError; whatever it is we'll need to abort
                if (webStream.locked) reader.releaseLock()
                webStream.cancel().catch(e => undefined)
                if (!stream.destroyed) stream.destroy()
                return e
            }).then(result => {
                if (result instanceof Error || !result) return result
                
                let pushed
                if (!result.done) {
                    pushing = false
                    pushed = pushToStream(result.value) 
                }
                return {readyForMore: pushed || false, streamDone: result.done }
            })
        }
    }

    async getNextChunk() {
        let scanning_chunk = await this.getNextAttachment()
        console.log(this.id, "Next chunk requested; got attachment", scanning_chunk)
        if (!scanning_chunk) return null

        let {
            byteStart, byteEnd, scan_files_begin, scan_files_end
        } = this.ranges

        let headers: HeadersInit =
            this.ranges.useRanges
                ? {
                    Range: `bytes=${
                        this.position == 0
                            ? byteStart - scan_files_begin * this.pointer.chunkSize!
                            : "0"
                    }-${
                        this.attachmentBuffer.length == 0 && this.msgIdx == scan_files_end
                            ? byteEnd - scan_files_end * this.pointer.chunkSize!
                            : ""
                    }`,
                  }
                : {}

        this.aborter = new AbortController()

        let response = await fetch(scanning_chunk.url, {headers, signal: this.aborter.signal})
            .catch((e: Error) => {
                console.error(e)
                return {body: e}
            })

        this.position++
        
        return response.body
    }

    currentPusher?: (() => Promise<{readyForMore: boolean, streamDone: boolean } | void> | undefined)
    busy: boolean = false

    async pushData(): Promise<boolean | undefined> {

        // uh oh, we don't have a currentPusher
        // let's make one then
        if (!this.currentPusher) {
            let next = await this.getNextChunk()
            if (next && !(next instanceof Error)) {
                // okay, so we have a new chunk
                // let's generate a new currentPusher
                this.currentPusher = await this.getPusherForWebStream(next)
            } else {
                // oops, look like there's an error
                // or the stream has ended.
                // let's destroy the stream
                console.log(this.id, "Ending", next)
                if (next) this.destroy(next); else this.push(null)
                return
            }
        }

        let result = await this.currentPusher()

        if (result?.streamDone) {
            this.aborter = undefined
            this.currentPusher = undefined
            return this.pushData()
        } else return result?.readyForMore

    }
}

export class UploadStream extends Writable {

    uploadId?: string
    name?: string
    mime?: string
    owner?: string

    files: Files

    error?: Error

    constructor(files: Files, owner?: string) {
        super()
        this.owner = owner
        this.files = files
    }

    // implementing some stuff

    async _write(data: Buffer, encoding: string, callback: () => void) {
        console.log("Write to stream attempted")
        if (this.filled + data.byteLength > (this.files.config.maxDiscordFileSize*this.files.config.maxDiscordFiles))
            return this.destroy(new WebError(413, "maximum file size exceeded"))

        // cut up the buffer into message sized chunks

        let position = 0
        let readyForMore = false

        while (position < data.byteLength) {
            let capture = Math.min(
                ((this.files.config.maxDiscordFileSize*10) - (this.filled % (this.files.config.maxDiscordFileSize*10))), 
                data.byteLength-position
            )
            console.log(`Capturing ${capture} bytes for megachunk, ${data.subarray(position, position + capture).byteLength}`)
            if (!this.current) await this.getNextStream()
            if (!this.current) {
                this.destroy(new Error("getNextStream called during debounce")); return
            }

            readyForMore = this.current.push( data.subarray(position, position+capture) )
            console.log(`pushed ${data.byteLength} byte chunk`);
            position += capture, this.filled += capture

            // message is full, so tell the next run to get a new message
            if (this.filled % (this.files.config.maxDiscordFileSize*10) == 0) {
                this.current!.push(null)
                this.current = undefined
            }
        }

        if (readyForMore || !this.current) callback()
        else this.once("exec-callback", callback)
    }

    async _final(callback: (error?: Error | null | undefined) => void) {
        if (this.current) {
            this.current.push(null);
            // i probably dnt need this but whateverrr :3
            await new Promise((res,rej) => this.once("debounceReleased", res))
        }
        callback()
    }

    aborted: boolean = false

    async _destroy(error: Error | null, callback: (err?: Error|null) => void) {
        this.error = error || undefined
        await this.abort()
        callback()
    }

    /** 
     * @description Cancel & unlock the file. When destroy() is called with a non-WebError, this is automatically called
    */
    async abort() {
        if (this.aborted) return
        this.aborted = true
        console.log("Aborting")
        if (!this.destroyed) this.destroy()
        if (this.current) this.current.destroy(this.error)
        await this.files.api.deleteMessages(this.messages)
        if (this.uploadId) {
            delete this.files.locks[this.uploadId]
        }
    }

    /**
     * @description Commit the file to the database
     * @returns The file's ID
     */
    async commit() {
        if (this.errored) throw this.error
        if (!this.writableFinished) {
            let err = Error("attempted to commit file when the stream was still unfinished")
            if (!this.destroyed) {this.destroy(err)}; throw err
        }

        // Perform checks
        if (!this.mime) {
            this.abort()
            throw new WebError(400, "no mime provided")
        }
        if (!this.name) {
            this.abort()
            throw new WebError(400, "no filename provided")
        }

        if (!this.uploadId) this.setUploadId(generateFileId())
        
        let ogf = this.files.files[this.uploadId!]

        this.files.files[this.uploadId!] = {
            filename: this.name,
            mime: this.mime,
            messageids: this.messages,
            owner: this.owner,
            sizeInBytes: this.filled,
            visibility: ogf ? ogf.visibility
            : (
                this.owner 
                ? Accounts.getFromId(this.owner)?.defaultFileVisibility 
                : undefined
            ),
            // so that json.stringify doesnt include tag:undefined
            ...((ogf||{}).tag ? {tag:ogf.tag} : {}),

            chunkSize: this.files.config.maxDiscordFileSize
        }

        delete this.files.locks[this.uploadId!]
        if (ogf?.messageids) await this.files.api.deleteMessages(ogf.messageids)
        await this.files.write()
        if (this.owner) Accounts.files.index(this.owner, this.uploadId!)
        return this.uploadId
    }

    // exposed methods

    setName(name: string) {
        if (this.name)
            return this.destroy( new WebError(400, "duplicate attempt to set filename") )
        if (name.length > 512)
            return this.destroy( new WebError(400, "filename can be a maximum of 512 characters") )
        
        this.name = name;
        return this
    }

    setType(type: string) { 
        if (this.mime)
            return this.destroy( new WebError(400, "duplicate attempt to set mime type") )
        if (type.length > 256)
            return this.destroy( new WebError(400, "mime type can be a maximum of 256 characters") )
        
        this.mime = type;
        return this
    }

    setUploadId(id: string) {
        if (this.uploadId)
            return this.destroy( new WebError(400, "duplicate attempt to set upload ID") )
        if (!id || id.match(id_check_regex)?.[0] != id
            || id.length > this.files.config.maxUploadIdLength)
            return this.destroy( new WebError(400, "invalid file ID") )

        if (this.files.files[id] && this.files.files[id].owner != this.owner)
            return this.destroy( new WebError(403, "you don't own this file") )

        if (this.files.locks[id])
            return this.destroy( new WebError(409, "a file with this ID is already being uploaded") )

        this.files.locks[id] = true
        this.uploadId = id
        return this
    } 

    // merged StreamBuffer helper
    
    filled: number = 0
    current?: Readable
    messages: string[] = []
    
    private newmessage_debounce : boolean = true
    
    private async startMessage(): Promise<Readable | undefined> {

        if (!this.newmessage_debounce) return
        this.newmessage_debounce = false

        let wrt = this

        let stream = new Readable({
            read() {
                // this is stupid but it should work
                console.log("Read called; calling on server to execute callback")
                wrt.emit("exec-callback")
            }
        })
        stream.pause()
        
        console.log(`Starting a message`)
        this.files.api.send(stream).then(message => {
            this.messages.push(message.id)
            console.log(`Sent: ${message.id}`)
            this.newmessage_debounce = true
            this.emit("debounceReleased")
        }).catch(e => {
            if (!this.errored) this.destroy(e)
        })

        return stream
        
    }

    private async getNextStream() {
        console.log("Getting stream...")
        console.log("current:" + (this.current ? "yes" : "no"))
        if (this.current) return this.current
        else if (this.newmessage_debounce) {
            // startmessage.... idk
            this.current = await this.startMessage();
            return this.current
        } else {
            return new Promise((resolve, reject) => {
                console.log("Waiting for debounce to be released...")
                this.once("debounceReleased", async () => resolve(await this.getNextStream()))
            })
        }
    }
}

export default class Files {
    config: Configuration
    api: API
    files: { [key: string]: FilePointer } = {}
    data_directory: string = `${process.cwd()}/.data`

    locks: Record<string, boolean> = {} // I'll, like, do something more proper later 

    constructor(config: Configuration) {
        this.config = config
        this.api = new API(process.env.TOKEN!, config)

        readFile(this.data_directory+ "/files.json")
            .then((buf) => {
                this.files = JSON.parse(buf.toString() || "{}")
            })
            .catch(console.error)
    }

    createWriteStream(owner?: string) {
        return new UploadStream(this, owner)
    }

    // fs

    /**
     * @description Saves file database
     * 
     */
    async write(): Promise<void> {
        await writeFile(
            this.data_directory + "/files.json",
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
    ): Promise<ReadStream> {
        if (this.files[uploadId]) {
            let file = this.files[uploadId]
            if (!file.sizeInBytes || !file.chunkSize) await this.update(uploadId)
            return new ReadStream(this, file, range)
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

        await this.api.deleteMessages(target.messageids)

        if (target.owner) {
            let id = files.deindex(target.owner, uploadId, noWrite)
            if (id) await id
        }
        delete this.files[uploadId]

        if (!noWrite) this.write().catch((err) => {
            throw err
        })
    }

}
