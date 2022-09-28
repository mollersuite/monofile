import bodyParser from "body-parser"
import multer, {memoryStorage} from "multer"
import Discord, { Intents, Client } from "discord.js"
import express from "express"
import fs from "fs"
import axios from "axios"

require('dotenv').config()

let app = express()

const multerSetup = multer({storage:memoryStorage()})

let config = require("../config.json")
app.use(bodyParser.json({limit:(config.maxDiscordFileSize*config.maxDiscordFiles)+1048576}))
let files:{[key:string]:{filename:string,mime:string,messageids:string[]}} = {}

// funcs

function ThrowError(response:express.Response,code:number,errorMessage:string) {
    fs.readFile(__dirname+"/../pages/error.html",(err,buf) => {
        if (err) {response.sendStatus(500);console.log(err);return}
        response.status(code)
        response.send(buf.toString().replace("$ErrorCode",code.toString()).replace("$ErrorMessage",errorMessage))
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
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.MESSAGE_CONTENT
],restRequestTimeout:config.requestTimeout})

let uploadChannel:Discord.TextBasedChannel

app.get("/", function(req,res) {
    fs.readFile(__dirname+"/../pages/upload.html",(err,buf) => {
        if (err) {res.sendStatus(500);console.log(err);return}
        res.send(buf.toString().replace("$MaxInstanceFilesize",`${(config.maxDiscordFileSize*config.maxDiscordFiles)/1048576}MB`))
    })
})

app.post("/upload",multerSetup.single('file'),async (req,res) => {
    if (req.file) {
        if (!req.file.originalname || !req.file.mimetype) {res.status(400); res.send("[err] missing name/mime");return}

        let uploadId = Math.random().toString().slice(2)
        
        if (files[uploadId]) {res.status(500); res.send("[err] please try again"); return}
        if (req.file.originalname.length > 64) {res.status(400); res.send("[err] name too long"); return}
        if (req.file.mimetype.length > 64) {res.status(400); res.send("[err] mime too long"); return}

        // get buffer
        let fBuffer = req.file.buffer
        if (fBuffer.byteLength >= (config.maxDiscordFileSize*config.maxDiscordFiles)) {res.status(400); res.send("[err] file too large"); return}
        
        // generate buffers to upload
        let toUpload = []
        for (let i = 0; i < Math.ceil(fBuffer.byteLength/config.maxDiscordFileSize); i++) {
            toUpload.push(fBuffer.subarray(i*config.maxDiscordFileSize,Math.min(fBuffer.byteLength,(i+1)*config.maxDiscordFileSize)))
        }

        // begin uploading
        let uploadTmplt:Discord.FileOptions[] = toUpload.map((e) => {return {name:Math.random().toString().slice(2),attachment:e}})
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
                res.status(500); res.send("[err] please try again"); return
            }
        }

        // save

        files[uploadId] = {
            filename:req.file.originalname,
            messageids:msgIds,
            mime:req.file.mimetype
        }

        fs.writeFile(__dirname+"/../.data/files.json",JSON.stringify(files),(err) => {
            if (err) {res.status(500); res.send("[err] please try again"); delete files[uploadId];return}
            res.send(uploadId)    
        })

    } else {
        res.status(400)
        res.send("[err] bad request")
    }
})

app.get("/download/:fileId",(req,res) => {
    if (files[req.params.fileId]) {
        let file = files[req.params.fileId]

        fs.readFile(__dirname+"/../pages/download.html",(err,buf) => {
            if (err) {res.sendStatus(500);console.log(err);return}
            res.send(buf.toString().replace(/\$FileName/g,file.filename).replace(/\$FileId/g,req.params.fileId))
        })
    } else {
        ThrowError(res,404,"File not found. <a href=\"javascript:history.back()\">Back</a> <a href=\"/\">Home</a>")
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

app.get("*",(req,res) => {
    ThrowError(res,404,"Page not found. <a href=\"javascript:history.back()\">Back</a> <a href=\"/\">Home</a>")
})



client.on("ready",() => {
    console.log("Discord OK!")

    client.guilds.fetch(config.targetGuild).then((g) => {
        g.channels.fetch(config.targetChannel).then((a) => {
            if (a?.isText()) {
                uploadChannel = a
            }
        })
    })
})

app.listen(3000,function() {
    console.log("Web OK!")
})

client.login(process.env.TOKEN)