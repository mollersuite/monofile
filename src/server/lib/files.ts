import axios from "axios";
import Discord, { Client, TextBasedChannel } from "discord.js";
import { readFile, writeFile } from "fs";
import { Readable } from "node:stream";
import crypto from "node:crypto";
import { files } from "./accounts";

import * as Accounts from "./accounts";

export let id_check_regex = /[A-Za-z0-9_\-\.\!\=\:\&\$\,\+\;\@\~\*\(\)\']+/
export let alphanum = Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890")

// bad solution but whatever

export type FileVisibility = "public" | "anonymous" | "private"

/**
 * @description Generates an alphanumeric string, used for files
 * @param length Length of the ID
 * @returns a random alphanumeric string
 */
export function generateFileId(length:number=5) {
    let fid = ""
    for (let i = 0; i < length; i++) {
        fid += alphanum[crypto.randomInt(0,alphanum.length)]
    }
    return fid
}

export interface FileUploadSettings {
    name?: string,
    mime: string,
    uploadId?: string,
    owner?:string
}

export interface Configuration {
    maxDiscordFiles: number,
    maxDiscordFileSize: number,
    targetGuild: string,
    targetChannel: string,
    requestTimeout: number,
    maxUploadIdLength: number,

    accounts: {
        registrationEnabled: boolean,
        requiredForUpload: boolean
    },

    trustProxy: boolean,
    forceSSL: boolean
}

export interface FilePointer {
    filename:string,
    mime:string,
    messageids:string[],
    owner?:string,
    sizeInBytes?:number,
    tag?:string,
    visibility?:FileVisibility,
    reserved?: boolean,
    chunkSize?: number
}

export interface StatusCodeError {
    status: number,
    message: string
}

/*  */

export default class Files {

    config: Configuration
    client: Client
    files: {[key:string]:FilePointer} = {}
    uploadChannel?: TextBasedChannel

    constructor(client: Client, config: Configuration) {

        this.config = config;
        this.client = client;

        client.on("ready",() => {
            console.log("Discord OK!")
        
            client.guilds.fetch(config.targetGuild).then((g) => {
                g.channels.fetch(config.targetChannel).then((a) => {
                    if (a?.isTextBased()) {
                        this.uploadChannel = a
                    }
                })
            })
        })

        readFile(process.cwd()+"/.data/files.json",(err,buf) => {
            if (err) {console.log(err);return}
            this.files = JSON.parse(buf.toString() || "{}")
        })

    }
    
    /**
     * @description Uploads a new file
     * @param settings Settings for your new upload
     * @param fBuffer Buffer containing file content
     * @returns Promise which resolves to the ID of the new file
     */
    uploadFile(settings:FileUploadSettings,fBuffer:Buffer):Promise<string|StatusCodeError> {
        return new Promise<string>(async (resolve,reject) => {
            if (!this.uploadChannel) {
                reject({status:503,message:"server is not ready - please try again later"})
                return
            }

            if (!settings.name || !settings.mime) {
                reject({status:400,message:"missing name/mime"});
                return
            }

            if (!settings.owner && this.config.accounts.requiredForUpload) {
                reject({status:401,message:"an account is required for upload"});
                return
            }
    
            let uploadId = (settings.uploadId || generateFileId()).toString();
    
            if ((uploadId.match(id_check_regex) || [])[0] != uploadId || uploadId.length > this.config.maxUploadIdLength) {
                reject({status:400,message:"invalid id"});return
            }
            
            if (this.files[uploadId] && (settings.owner ? this.files[uploadId].owner != settings.owner : true)) {
                reject({status:400,message:"you are not the owner of this file id"});
                return
            }

            if (this.files[uploadId] && this.files[uploadId].reserved) {
                reject({status:400,message:"already uploading this file. if your file is stuck in this state, contact an administrator"});
                return
            }

            if (settings.name.length > 128) {
                reject({status:400,message:"name too long"}); 
                return
            }

            if (settings.mime.length > 128) {
                reject({status:400,message:"mime too long"}); 
                return
            }

            // reserve file, hopefully should prevent
            // large files breaking

            let ogf = this.files[uploadId]

            this.files[uploadId] = {
                    filename:settings.name,
                    messageids:[],
                    mime:settings.mime,
                    sizeInBytes:0,

                    owner:settings.owner,
                    visibility: settings.owner ? "private" : "public",
                    reserved: true,

                    chunkSize: this.config.maxDiscordFileSize
                }
            
            // save

            if (settings.owner) {
                await files.index(settings.owner,uploadId)
            }
    
            // get buffer
            if (fBuffer.byteLength >= (this.config.maxDiscordFileSize*this.config.maxDiscordFiles)) {
                reject({status:400,message:"file too large"}); 
                return
            }
            
            // generate buffers to upload
            let toUpload = []
            for (let i = 0; i < Math.ceil(fBuffer.byteLength/this.config.maxDiscordFileSize); i++) {
                toUpload.push(
                    fBuffer.subarray(
                        i*this.config.maxDiscordFileSize,
                        Math.min(
                            fBuffer.byteLength,
                            (i+1)*this.config.maxDiscordFileSize
                        )
                    )
                )
            }
    
            // begin uploading
            let uploadTmplt:Discord.AttachmentBuilder[] = toUpload.map((e) => {
                return new Discord.AttachmentBuilder(e)
                            .setName(Math.random().toString().slice(2))
            })
            let uploadGroups = []
            for (let i = 0; i < Math.ceil(uploadTmplt.length/10); i++) {
                uploadGroups.push(uploadTmplt.slice(i*10,((i+1)*10)))
            }
    
            let msgIds = []
    
            for (let i = 0; i < uploadGroups.length; i++) {

                let ms = await this.uploadChannel.send({
                    files:uploadGroups[i]
                }).catch((e) => {console.error(e)})

                if (ms) {
                    msgIds.push(ms.id)
                } else {
                    if (!ogf) delete this.files[uploadId]
                    else this.files[uploadId] = ogf
                    reject({status:500,message:"please try again"}); return
                }
            }

            // this code deletes the files from discord, btw
            // if need be, replace with job queue system

            if (ogf&&this.uploadChannel) {
                for (let x of ogf.messageids) {
                    this.uploadChannel.messages.delete(x).catch(err => console.error(err))
                }
            }

            resolve(await this.writeFile(
                uploadId,
                {
                    filename:settings.name,
                    messageids:msgIds,
                    mime:settings.mime,
                    sizeInBytes:fBuffer.byteLength,

                    owner:settings.owner,
                    visibility: ogf ? ogf.visibility
                    : (
                        settings.owner 
                        ? Accounts.getFromId(settings.owner)?.defaultFileVisibility 
                        : undefined
                    ),
                    // so that json.stringify doesnt include tag:undefined
                    ...((ogf||{}).tag ? {tag:ogf.tag} : {}),

                    chunkSize: this.config.maxDiscordFileSize
                }
            ))

            
        })
    }
    
    // fs

    /**
     * @description Writes a file to disk
     * @param uploadId New file's ID
     * @param file FilePointer representing the new file
     * @returns Promise which resolves to the file's ID
     */
    writeFile(uploadId: string, file: FilePointer):Promise<string> {
        return new Promise((resolve, reject) => {

            this.files[uploadId] = file
            
            writeFile(process.cwd()+"/.data/files.json",JSON.stringify(this.files),(err) => {
                
                if (err) {
                    reject({status:500,message:"server may be misconfigured, contact admin for help"}); 
                    delete this.files[uploadId];
                    return
                }

                resolve(uploadId)
                
            })

        }) 
    }

    /**
     * @description Read a file
     * @param uploadId Target file's ID
     * @param range Byte range to get
     * @returns A `Readable` containing the file's contents
     */
    readFileStream(uploadId: string, range?: {start:number, end:number}):Promise<Readable> {
        return new Promise(async (resolve,reject) => {
            if (!this.uploadChannel) {
                reject({status:503,message:"server is not ready - please try again later"})
                return
            }

            if (this.files[uploadId]) {
                let file = this.files[uploadId]

                let 
                    scan_msg_begin   = 0,
                    scan_msg_end     = file.messageids.length-1,
                    scan_files_begin = 0,
                    scan_files_end   = -1

                let useRanges = range && file.chunkSize && file.sizeInBytes;

                // todo: figure out how to get typesccript to accept useRanges
                // i'm too tired to look it up or write whatever it wnats me to do
                if (range && file.chunkSize && file.sizeInBytes) {

                    // Calculate where to start file scans...

                    scan_files_begin = Math.floor(range.start / file.chunkSize)
                    scan_files_end = Math.ceil(range.end / file.chunkSize) - 1

                    scan_msg_begin = Math.floor(scan_files_begin / 10)
                    scan_msg_end = Math.ceil(scan_files_end / 10)
                    
                }

                let attachments: Discord.Attachment[] = [];

                /* File updates */ 
                let file_updates: Pick<FilePointer, "chunkSize" | "sizeInBytes"> = {}
                let atSIB: number[] = [] // kepes track of the size of each file...

                for (let xi = scan_msg_begin; xi < scan_msg_end+1; xi++) {

                    let msg = await this.uploadChannel.messages.fetch(file.messageids[xi]).catch(() => {return null})
                    if (msg?.attachments) {

                        let attach = Array.from(msg.attachments.values())
                        for (let i = (useRanges && xi == scan_msg_begin ? ( scan_files_begin - (xi*10) ) : 0); i < (useRanges && xi == scan_msg_end ? ( scan_files_end - (xi*10) + 1 ) : attach.length); i++) {

                            attachments.push(attach[i])
                            atSIB.push(attach[i].size)

                        }

                    }

                }

                if (!file.sizeInBytes) file_updates.sizeInBytes = atSIB.reduce((a,b) => a+b, 0);
                if (!file.chunkSize) file_updates.chunkSize = atSIB[0]
                if (Object.keys(file_updates).length) { // if file_updates not empty
                    // i gotta do these weird workarounds, ts is weird sometimes
                    // originally i was gonna do key is keyof FilePointer but for some reason 
                    // it ended up making typeof file[key] never??? so 
                    // its 10pm and chinese people suck at being quiet so i just wanna get this over with
                    // chinese is the worst language in terms of volume lmao
                    let valid_fp_keys = ["sizeInBytes", "chunkSize"]
                    let isValidFilePointerKey = (key: string): key is "sizeInBytes" | "chunkSize" => valid_fp_keys.includes(key)

                    for (let [key,value] of Object.entries(file_updates)) {
                        if (isValidFilePointerKey(key)) file[key] = value
                    }

                    writeFile(process.cwd()+"/.data/files.json",JSON.stringify(this.files),(err) => {})
                }

                let position = 0;

                let getNextChunk = async () => {
                    let scanning_chunk = attachments[position]
                    if (!scanning_chunk) {
                        return null
                    }
                    
                    let d = await axios.get(
                        scanning_chunk.url,
                        {
                            responseType:"arraybuffer",
                            headers: {
                                ...(useRanges ? {
                                    "Range": `bytes=${position == 0 && range && file.chunkSize ? range.start-(scan_files_begin*file.chunkSize) : "0"}-${position == attachments.length-1 && range && file.chunkSize ? range.end-(scan_files_end*file.chunkSize) : ""}`
                                } : {})
                            }
                        }
                    ).catch((e:Error) => {console.error(e)})

                    position++;

                    if (d) {
                        return d.data
                    } else {
                        reject({status:500,message:"internal server error"})
                        return "__ERR"
                    }
                }
                
                let ord:number[] = []
                // hopefully this regulates it?
                let lastChunkSent = true

                let dataStream = new Readable({
                    read(){
                        if (!lastChunkSent) return
                        lastChunkSent = false
                        getNextChunk().then(async (nextChunk) => {
                            if (nextChunk == "__ERR") {this.destroy(new Error("file read error")); return}
                            let response = this.push(nextChunk)

                            if (!nextChunk) return // EOF

                            while (response) {
                                let nextChunk = await getNextChunk()
                                response = this.push(nextChunk)
                                if (!nextChunk) return
                            }
                            lastChunkSent = true
                        })
                    }
                })

                resolve(dataStream)
                
            } else {
                reject({status:404,message:"not found"})
            }
        })
    }

    /**
     * @description Deletes a file
     * @param uploadId Target file's ID
     * @param noWrite Whether or not the change should be written to disk. Enable for bulk deletes
     */
    unlink(uploadId:string, noWrite: boolean = false):Promise<void> {
        return new Promise(async (resolve,reject) => {
            let tmp = this.files[uploadId];
            if (!tmp) {resolve(); return}
            if (tmp.owner) {
                let id = files.deindex(tmp.owner,uploadId,noWrite);
                if (id) await id
            }
            // this code deletes the files from discord, btw
            // if need be, replace with job queue system

            if (!this.uploadChannel) {reject(); return}
            for (let x of tmp.messageids) {
                this.uploadChannel.messages.delete(x).catch(err => console.error(err))
            }

            delete this.files[uploadId];
            if (noWrite) {resolve(); return}
            writeFile(process.cwd()+"/.data/files.json",JSON.stringify(this.files),(err) => {
                if (err) {
                    this.files[uploadId] = tmp // !! this may not work, since tmp is a link to this.files[uploadId]?
                    reject()
                } else {
                    resolve()
                }
            })

        })
    }

    /**
     * @description Get a file's FilePointer
     * @param uploadId Target file's ID
     * @returns FilePointer for the file
     */
    getFilePointer(uploadId:string):FilePointer {
        return this.files[uploadId]
    }

}
