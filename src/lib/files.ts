import Discord, { Client, TextBasedChannel } from "discord.js";
import { readFile, writeFile } from "fs";


export let id_check_regex = /[A-Za-z0-9_\-\.]+/


export interface FileUploadSettings {
    name?: string,
    mime: string,
    uploadId?: string
}

export interface Configuration {
    maxDiscordFiles: number,
    maxDiscordFileSize: number,
    targetGuild: string,
    targetChannel: string,
    requestTimeout: number
}

export interface FilePointer {
    filename:string,
    mime:string,
    messageids:string[]
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
    }
    
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
    
            let uploadId = (settings.uploadId || Math.random().toString().slice(2)).toString();
    
            if ((uploadId.match(id_check_regex) || [])[0] != uploadId || uploadId.length > 30) {
                reject({status:400,message:"invalid id"});return
            }
            
            if (this.files[uploadId]) {
                reject({status:400,message:"a file with this id already exists"});
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
                    reject({status:500,message:"please try again"}); return
                }
            }
    
            // save

            return this.writeFile(
                uploadId,
                {
                    filename:settings.name,
                    messageids:msgIds,
                    mime:settings.mime
                }
            )
        })
    }
    
    // fs

    writeFile(uploadId: string, file: FilePointer):Promise<string|StatusCodeError> {
        return new Promise((resolve, reject) => {

            this.files[uploadId] = file
            
            writeFile(process.cwd()+"/.data/files.json",JSON.stringify(this.files),(err) => {
                
                if (err) {
                    reject({status:500,message:"please try again"}); 
                    delete this.files[uploadId];
                    return
                }

                resolve(uploadId)
                
            })

        }) 
    }

    // todo: move read code here

    readFile(uploadId: string):Promise<Buffer|StatusCodeError> {
        
    }

    unlink():Promise<void> {
        
    }

}