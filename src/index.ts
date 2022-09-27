import bodyParser from "body-parser"
import Discord, { Intents, Client } from "discord.js"
import express from "express"
import fs from "fs"

require('dotenv').config()

let app = express()

let config = require("../config.json")
app.use(bodyParser.json({limit:(config.maxDiscordFileSize*config.maxDiscordFiles)}))
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
]})

let uploadChannel:Discord.TextBasedChannel

app.get("/", function(req,res) {
    fs.readFile(__dirname+"/../pages/upload.html",(err,buf) => {
        if (err) {res.sendStatus(500);console.log(err);return}
        res.send(buf.toString().replace("$MaxInstanceFilesize",`${(config.maxDiscordFileSize*config.maxDiscordFiles)/1048576}MB`))
    })
})

app.post("/upload",(req,res) => {
    res.sendStatus(404)
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

        for (let i = 0; i < file.messageids.length; i++) {
            let msg = await uploadChannel.messages.fetch(file.messageids[i]).catch(() => {return null})
            if (msg?.attachments) {
                
            }
        }

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