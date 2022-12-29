import bodyParser from "body-parser"
import multer, {memoryStorage} from "multer"
import Discord, { IntentsBitField, Client } from "discord.js"
import express from "express"
import fs from "fs"
import axios, { AxiosResponse } from "axios"

require('dotenv').config()
let pkg = require(`${process.cwd()}/package.json`)

let app = express()

const multerSetup = multer({storage:memoryStorage()})

let config = require(`${process.cwd()}/config.json`)
app.use("/static",express.static("assets"))
app.use(bodyParser.text({limit:(config.maxDiscordFileSize*config.maxDiscordFiles)+1048576,type:["application/json","text/plain"]}))
let files:{[key:string]:{filename:string,mime:string,messageids:string[]}} = {}

// funcs

function ThrowError(response:express.Response,code:number,errorMessage:string) {
    fs.readFile(__dirname+"/../pages/error.html",(err,buf) => {
        if (err) {response.sendStatus(500);console.log(err);return}
        response.status(code)
        response.send(buf.toString().replace(/\$ErrorCode/g,code.toString()).replace(/\$ErrorMessage/g,errorMessage).replace(/\$Version/g,pkg.version))
    })
}

// init data

if (!fs.existsSync(__dirname+"/../.data/")) fs.mkdirSync(__dirname+"/../.data/")

fs.readFile(__dirname+"/../.data/files.json",(err,buf) => {
    if (err) {console.log(err);return}
    files = JSON.parse(buf.toString() || "{}")
})

// discord

let client = new Client({intents:[
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent
],rest:{timeout:config.requestTimeout}})

let uploadChannel:Discord.TextBasedChannel

interface FileUploadSettings {
    name?: string,
    mime: string,
    uploadId?: string
}

let uploadFile = (settings:FileUploadSettings,fBuffer:Buffer) => {
    return new Promise<string>(async (resolve,reject) => {
        if (!settings.name || !settings.mime) {reject({status:400,message:"missing name/mime"});return}

        let uploadId = settings.uploadId || Math.random().toString().slice(2)
        
        if (files[uploadId]) {reject({status:500,message:"please try again"});return}
        if (settings.name.length > 128) {reject({status:400,message:"name too long"}); return}
        if (settings.name.length > 128) {reject({status:400,message:"mime too long"}); return}

        // get buffer
        if (fBuffer.byteLength >= (config.maxDiscordFileSize*config.maxDiscordFiles)) {reject({status:400,message:"file too large"}); return}
        
        // generate buffers to upload
        let toUpload = []
        for (let i = 0; i < Math.ceil(fBuffer.byteLength/config.maxDiscordFileSize); i++) {
            toUpload.push(fBuffer.subarray(i*config.maxDiscordFileSize,Math.min(fBuffer.byteLength,(i+1)*config.maxDiscordFileSize)))
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

        fs.writeFile(__dirname+"/../.data/files.json",JSON.stringify(files),(err) => {
            if (err) {reject({status:500,message:"please try again"}); delete files[uploadId];return}
            resolve(uploadId)    
        })
    })
}

app.get("/", function(req,res) {
    fs.readFile(__dirname+"/../pages/upload.html",(err,buf) => {
        if (err) {res.sendStatus(500);console.log(err);return}
        res.send(buf.toString().replace("$MaxInstanceFilesize",`${(config.maxDiscordFileSize*config.maxDiscordFiles)/1048576}MB`).replace(/\$Version/g,pkg.version))
    })
})

app.get("/clone", function(req,res) {
    fs.readFile(__dirname+"/../pages/clone.html",(err,buf) => {
        if (err) {res.sendStatus(500);console.log(err);return}
        res.send(buf.toString().replace("$MaxInstanceFilesize",`${(config.maxDiscordFileSize*config.maxDiscordFiles)/1048576}MB`).replace(/\$Version/g,pkg.version))
    })
})

app.post("/upload",multerSetup.single('file'),async (req,res) => {
    if (req.file) {
        uploadFile({name:req.file.originalname,mime:req.file.mimetype},req.file.buffer)
            .then((uID) => res.send(uID))
            .catch((stat) => {res.status(stat.status);res.send(`[err] ${stat.message}`)})
    } else {
        res.status(400)
        res.send("[err] bad request")
    }
})

app.post("/clone",(req,res) => {
    axios.get(req.body,{responseType:"arraybuffer"}).then((data:AxiosResponse) => {
        uploadFile({name:req.body.split("/")[req.body.split("/").length-1] || "generic",mime:data.headers["content-type"]},Buffer.from(data.data))
            .then((uID) => res.send(uID))
            .catch((stat) => {res.status(stat.status);res.send(`[err] ${stat.message}`)})
    }).catch((err) => {
        res.status(400)
        res.send(`[err] failed to fetch data`)
    })
})

app.get("/download/:fileId",(req,res) => {
    if (files[req.params.fileId]) {
        let file = files[req.params.fileId]

        fs.readFile(__dirname+"/../pages/download.html",(err,buf) => {
            if (err) {res.sendStatus(500);console.log(err);return}
            res.send(buf.toString().replace(/\$FileName/g,file.filename).replace(/\$FileId/g,req.params.fileId).replace(/\$Version/g,pkg.version))
        })
    } else {
        ThrowError(res,404,"File not found.")
    }
})

app.get("/file/:fileId",async (req,res) => {
    if (files[req.params.fileId]) {
        let file = files[req.params.fileId]
        let bufToCombine = []

        for (let i = 0; i < file.messageids.length; i++) {
            let msg = await uploadChannel.messages.fetch(file.messageids[i]).catch(() => {return null})
            if (msg?.attachments) {
                let attach = Array.from(msg.attachments.values())
                for (let i = 0; i < attach.length; i++) {
                    let d = await axios.get(attach[i].url,{responseType:"arraybuffer"}).catch((e:Error) => {console.error(e)})
                    if (d) {
                        bufToCombine.push(d.data)
                    } else {
                        res.sendStatus(500);return
                    }
                }
            }
        }

        let nb:Buffer|null = Buffer.concat(bufToCombine)

        res.setHeader('Content-Type',file.mime)
        res.send(nb)

        nb = null

    } else {
        res.sendStatus(404)
    }
})

app.get("/server",(req,res) => {
    res.send(JSON.stringify({...config,version:pkg.version}))
})

app.get("*",(req,res) => {
    ThrowError(res,404,"Page not found.")
})



client.on("ready",() => {
    console.log("Discord OK!")

    client.guilds.fetch(config.targetGuild).then((g) => {
        g.channels.fetch(config.targetChannel).then((a) => {
            if (a?.isTextBased()) {
                uploadChannel = a
            }
        })
    })
})

app.listen(3000,function() {
    console.log("Web OK!")
})

client.login(process.env.TOKEN)