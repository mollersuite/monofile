import axios from "axios"
import Discord, { Client, Message, TextBasedChannel, IntentsBitField } from "discord.js"
import { readFile, writeFile } from "node:fs/promises"
import { Readable } from "node:stream"
import crypto from "node:crypto"
import { files } from "./accounts"

import * as Accounts from "./accounts"

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

/*  */

export default class Files {
    config: Configuration
    client: Client
    files: { [key: string]: FilePointer } = {}
    uploadChannel?: TextBasedChannel

    constructor(config: Configuration) {
        this.config = config
        this.client = new Client({
            intents: [
                IntentsBitField.Flags.GuildMessages,
                IntentsBitField.Flags.MessageContent,
            ],
            rest: { timeout: config.requestTimeout },
        })
        

        this.client.on("ready", () => {
            console.log("Discord OK!")

            this.client.guilds.fetch(config.targetGuild).then((g) => {
                g.channels.fetch(config.targetChannel).then((a) => {
                    if (a?.isTextBased()) {
                        this.uploadChannel = a
                    }
                })
            })
        })

        this.client.login(process.env.TOKEN)

        readFile(process.cwd() + "/.data/files.json")
            .then((buf) => {
                this.files = JSON.parse(buf.toString() || "{}")
            })
            .catch(console.error)
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
        if (!this.uploadChannel)
            throw {
                status: 503,
                message: "server is not ready - please try again later",
            }

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
        let uploadTmplt: Discord.AttachmentBuilder[] = toUpload.map((e) => {
            return new Discord.AttachmentBuilder(e).setName(
                Math.random().toString().slice(2)
            )
        })
        let uploadGroups = []

        for (let i = 0; i < Math.ceil(uploadTmplt.length / 10); i++) {
            uploadGroups.push(uploadTmplt.slice(i * 10, (i + 1) * 10))
        }

        let msgIds = []

        for (const uploadGroup of uploadGroups) {
            let message = await this.uploadChannel
                .send({
                    files: uploadGroup,
                })
                .catch((e) => {
                    console.error(e)
                })

            if (message && message instanceof Message) {
                msgIds.push(message.id)
            } else {
                if (!existingFile) delete this.files[uploadId]
                else this.files[uploadId] = existingFile
                throw { status: 500, message: "please try again" }
            }
        }

        // this code deletes the files from discord, btw
        // if need be, replace with job queue system

        if (existingFile && this.uploadChannel) {
            for (let x of existingFile.messageids) {
                this.uploadChannel.messages
                    .delete(x)
                    .catch((err) => console.error(err))
            }
        }

        const { filename, mime, owner } = metadata
        return this.writeFile(uploadId, {
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
        })
    }

    // fs

    /**
     * @description Writes a file to disk
     * @param uploadId New file's ID
     * @param file FilePointer representing the new file
     * @returns Promise which resolves to the file's ID
     */
    async writeFile(uploadId: string, file: FilePointer): Promise<string> {
        this.files[uploadId] = file

        return writeFile(
            process.cwd() + "/.data/files.json",
            JSON.stringify(
                this.files,
                null,
                process.env.NODE_ENV === "development" ? 4 : undefined
            )
        )
            .then(() => uploadId)
            .catch(() => {
                delete this.files[uploadId]
                throw {
                    status: 500,
                    message:
                        "server may be misconfigured, contact admin for help",
                }
            })
    }

    /**
     * @description Read a file
     * @param uploadId Target file's ID
     * @param range Byte range to get
     * @returns A `Readable` containing the file's contents
     */
    async readFileStream(
        uploadId: string,
        range?: { start: number; end: number }
    ): Promise<Readable> {
        if (!this.uploadChannel) {
            throw {
                status: 503,
                message: "server is not ready - please try again later",
            }
        }

        if (this.files[uploadId]) {
            let file = this.files[uploadId]

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

            let attachments: Discord.Attachment[] = []

            /* File updates */
            let file_updates: Pick<FilePointer, "chunkSize" | "sizeInBytes"> =
                {}
            let atSIB: number[] = [] // kepes track of the size of each file...

            for (let xi = scan_msg_begin; xi < scan_msg_end + 1; xi++) {
                let msg = await this.uploadChannel.messages
                    .fetch(file.messageids[xi])
                    .catch(() => {
                        return null
                    })
                if (msg?.attachments) {
                    let attach = Array.from(msg.attachments.values())
                    for (
                        let i =
                        
                            useRanges && xi == scan_msg_begin
                                ? scan_files_begin - xi * 10
                                : 0;
                        i <
                        (useRanges && xi == scan_msg_end
                            ? scan_files_end - xi * 10 + 1
                            : attach.length);
                        i++
                    ) {
                        attachments.push(attach[i])
                        atSIB.push(attach[i].size)
                    }
                }
            }

            if (!file.sizeInBytes)
                file_updates.sizeInBytes = atSIB.reduce((a, b) => a + b, 0)
            if (!file.chunkSize) file_updates.chunkSize = atSIB[0]
            if (Object.keys(file_updates).length) {
                // if file_updates not empty
                // i gotta do these weird workarounds, ts is weird sometimes
                // originally i was gonna do key is keyof FilePointer but for some reason
                // it ended up making typeof file[key] never??? so
                // its 10pm and chinese people suck at being quiet so i just wanna get this over with
                // chinese is the worst language in terms of volume lmao
                let valid_fp_keys = ["sizeInBytes", "chunkSize"]
                let isValidFilePointerKey = (
                    key: string
                ): key is "sizeInBytes" | "chunkSize" =>
                    valid_fp_keys.includes(key)

                for (let [key, value] of Object.entries(file_updates)) {
                    if (isValidFilePointerKey(key)) file[key] = value
                }

                // The original was a callback so I don't think I'm supposed to `await` this -Jack
                writeFile(
                    process.cwd() + "/.data/files.json",
                    JSON.stringify(
                        this.files,
                        null,
                        process.env.NODE_ENV === "development" ? 4 : undefined
                    )
                )
            }

            let position = 0

            let getNextChunk = async () => {
                let scanning_chunk = attachments[position]
                if (!scanning_chunk) {
                    return null
                }

                let d = await axios
                    .get(scanning_chunk.url, {
                        responseType: "arraybuffer",
                        headers: {
                            ...(useRanges
                                ? {
                                      Range: `bytes=${
                                          position == 0 &&
                                          range &&
                                          file.chunkSize
                                              ? range.start -
                                                scan_files_begin *
                                                    file.chunkSize
                                              : "0"
                                      }-${
                                          position == attachments.length - 1 &&
                                          range &&
                                          file.chunkSize
                                              ? range.end -
                                                scan_files_end * file.chunkSize
                                              : ""
                                      }`,
                                  }
                                : {}),
                        },
                    })
                    .catch((e: Error) => {
                        console.error(e)
                    })

                position++

                if (d) {
                    return d.data
                } else {
                    throw {
                        status: 500,
                        message: "internal server error",
                    }
                }
            }

            let ord: number[] = []
            // hopefully this regulates it?
            let lastChunkSent = true

            let dataStream = new Readable({
                read() {
                    if (!lastChunkSent) return
                    lastChunkSent = false
                    getNextChunk().then(async (nextChunk) => {
                        if (nextChunk == "__ERR") {
                            this.destroy(new Error("file read error"))
                            return
                        }
                        let response = this.push(nextChunk)

                        if (!nextChunk) return // EOF

                        while (response) {
                            let nextChunk = await getNextChunk()
                            response = this.push(nextChunk)
                            if (!nextChunk) return
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
        let tmp = this.files[uploadId]
        if (!tmp) {
            return
        }
        if (tmp.owner) {
            let id = files.deindex(tmp.owner, uploadId, noWrite)
            if (id) await id
        }
        // this code deletes the files from discord, btw
        // if need be, replace with job queue system

        if (!this.uploadChannel) {
            return
        }
        for (let x of tmp.messageids) {
            this.uploadChannel.messages
                .delete(x)
                .catch((err) => console.error(err))
        }

        delete this.files[uploadId]
        if (noWrite) {
            return
        }
        return writeFile(
            process.cwd() + "/.data/files.json",
            JSON.stringify(
                this.files,
                null,
                process.env.NODE_ENV === "development" ? 4 : undefined
            )
        ).catch((err) => {
            this.files[uploadId] = tmp // !! this may not work, since tmp is a link to this.files[uploadId]?
            throw err
        })
    }

    /**
     * @description Get a file's FilePointer
     * @param uploadId Target file's ID
     * @returns FilePointer for the file
     */
    getFilePointer(uploadId: string): FilePointer {
        return this.files[uploadId]
    }
}
