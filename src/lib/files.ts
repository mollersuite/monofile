import Discord, { Client } from "discord.js";

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

/*  */

export default class Files {

    config: Configuration
    client: Client

    constructor(client: Client, config: Configuration) {
        this.config = config;
        this.client = client;
    }
    
    uploadFile(settings:FileUploadSettings,fBuffer:Buffer) {
        return new Promise<string>(async (resolve,reject) => {
            if (!settings.name || !settings.mime) {reject({status:400,message:"missing name/mime"});return}
    
            let uploadId = (settings.uploadId || Math.random().toString().slice(2)).toString();
    
            if ((uploadId.match(/[A-Za-z0-9_\-\.]+/)||[])[0] != uploadId || uploadId.length > 30) {reject({status:400,message:"invalid id"});return}
            
            if (files[uploadId]) {reject({status:400,message:"a file with this id already exists"});return}
            if (settings.name.length > 128) {reject({status:400,message:"name too long"}); return}
            if (settings.name.length > 128) {reject({status:400,message:"mime too long"}); return}
    
            // get buffer
            if (fBuffer.byteLength >= (this.config.maxDiscordFileSize*this.config.maxDiscordFiles)) {
                reject({status:400,message:"file too large"}); 
                return
            }
            
            // generate buffers to upload
            let toUpload = []
            for (let i = 0; i < Math.ceil(fBuffer.byteLength/this.config.maxDiscordFileSize); i++) {
                toUpload.push(fBuffer.subarray(i*this.config.maxDiscordFileSize,Math.min(fBuffer.byteLength,(i+1)*config.maxDiscordFileSize)))
            }
    
            // begin uploading
            let uploadTmplt:Discord.AttachmentBuilder[] = toUpload.map((e) => {return new Discord.AttachmentBuilder(e).setName(Math.random().toString().slice(2))})
            let uploadGroups = []
            for (let i = 0; i < Math.ceil(uploadTmplt.length/10); i++) {
                uploadGroups.push(uploadTmplt.slice(i*10,((i+1)*10)))
            }
    
            let msgIds = []
    
            for (let i = 0; i < uploadGroups.length; i++) {
                let ms = await uploadChannel.send({files:uploadGroups[i]}).catch((e) => {console.error(e)})
                if (ms) {
                    msgIds.push(ms.id)
                } else {
                    reject({status:500,message:"please try again"}); return
                }
            }
    
            // save
    
            files[uploadId] = {
                filename:settings.name,
                messageids:msgIds,
                mime:settings.mime
            }

            /* similar save/load/etc system to your other projects, split */
            /* you'll still need to do this later but whatever */
            /* also might be a good idea to switch to fs/promises  */
    
            fs.writeFile(__dirname+"/../.data/files.json",JSON.stringify(files),(err) => {
                if (err) {
                    reject({status:500,message:"please try again"}); 
                    delete files[uploadId];
                    return
                }
                resolve(uploadId)    
            })
        })
    }
    

}