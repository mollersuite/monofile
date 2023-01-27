/*
    i really should split this up into different modules
*/

import bodyParser from "body-parser"
import multer, {memoryStorage} from "multer"
import Discord, { IntentsBitField, Client } from "discord.js"
import express from "express"
import fs from "fs"
import axios, { AxiosResponse } from "axios"
import ServeError from "./lib/errors"

import Files from "./lib/files"
require("dotenv").config()

const multerSetup = multer({storage:memoryStorage()})
let pkg = require(`${process.cwd()}/package.json`)
let app = express()
let config = require(`${process.cwd()}/config.json`)

app.use("/static",express.static("assets"))
app.use(bodyParser.text({limit:(config.maxDiscordFileSize*config.maxDiscordFiles)+1048576,type:["application/json","text/plain"]}))
// funcs

// init data

if (!fs.existsSync(__dirname+"/../.data/")) fs.mkdirSync(__dirname+"/../.data/")



// discord

let client = new Client({intents:[
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent
],rest:{timeout:config.requestTimeout}})

let files = new Files(client,config)

// routes (could probably make these use routers)

// index, clone

app.get("/", function(req,res) {
    fs.readFile(__dirname+"/../pages/base.html",(err,buf) => {
        if (err) {res.sendStatus(500);console.log(err);return}
        res.send(
            buf.toString()
                .replace("$MaxInstanceFilesize",`${(config.maxDiscordFileSize*config.maxDiscordFiles)/1048576}MB`)
                .replace(/\$Version/g,pkg.version)
                .replace(/\$Handler/g,"upload_file")
                .replace(/\$UploadButtonText/g,"Upload file")
                .replace(/\$otherPath/g,"/clone")
                .replace(/\$otherText/g,"clone from url...")
                .replace(/\$FileNum/g,Object.keys(files.files).length.toString())
        )
    })
})

app.get("/clone", function(req,res) {
    fs.readFile(__dirname+"/../pages/base.html",(err,buf) => {
        if (err) {res.sendStatus(500);console.log(err);return}
        res.send(
            buf.toString()
                .replace("$MaxInstanceFilesize",`${(config.maxDiscordFileSize*config.maxDiscordFiles)/1048576}MB`)
                .replace(/\$Version/g,pkg.version)
                .replace(/\$Handler/g,"clone_file")
                .replace(/\$UploadButtonText/g,"Input a URL")
                .replace(/\$otherPath/g,"/")
                .replace(/\$otherText/g,"upload file...")
                .replace(/\$FileNum/g,Object.keys(files.files).length.toString())
        )
    })
})

// upload handlers

app.post("/upload",multerSetup.single('file'),async (req,res) => {
    if (req.file) {
        try {
            files.uploadFile({name:req.file.originalname,mime:req.file.mimetype,uploadId:req.header("monofile-upload-id")},req.file.buffer)
                .then((uID) => res.send(uID))
                .catch((stat) => {
                    res.status(stat.status);
                    res.send(`[err] ${stat.message}`)
                })
        } catch {
            res.status(400)
            res.send("[err] bad request")
        }
    } else {
        res.status(400)
        res.send("[err] bad request")
    }
})

app.post("/clone",(req,res) => {
    try {
        let j = JSON.parse(req.body)
        if (!j.url) {
            res.status(400)
            res.send("[err] invalid url")
        }
        axios.get(j.url,{responseType:"arraybuffer"}).then((data:AxiosResponse) => {
            files.uploadFile({name:j.url.split("/")[req.body.split("/").length-1] || "generic",mime:data.headers["content-type"],uploadId:j.uploadId},Buffer.from(data.data))
                .then((uID) => res.send(uID))
                .catch((stat) => {
                    res.status(stat.status);
                    res.send(`[err] ${stat.message}`)
                })
        }).catch((err) => {
            console.log(err)
            res.status(400)
            res.send(`[err] failed to fetch data`)
        })
    } catch {
        res.status(500)
        res.send("[err] an error occured")
    }
})

// serve files & download page

app.get("/download/:fileId",(req,res) => {
    if (files.getFilePointer(req.params.fileId)) {
        let file = files.getFilePointer(req.params.fileId)

        fs.readFile(__dirname+"/../pages/download.html",(err,buf) => {
            if (err) {res.sendStatus(500);console.log(err);return}
            res.send(
                buf.toString()
                .replace(/\$FileId/g,req.params.fileId)
                .replace(/\$Version/g,pkg.version)
                .replace(/\$FileName/g,
                    file.filename
                        .replace(/\&/g,"&amp;")
                        .replace(/\</g,"&lt;")
                        .replace(/\>/g,"&gt;")
                )
            )
        })
    } else {
        ServeError(res,404,"File not found.")
    }
})

app.get("/file/:fileId",async (req,res) => {
    files.readFileStream(req.params.fileId).then(f => {
        res.setHeader("Content-Type",f.contentType)
        res.status(200)
        f.dataStream.pipe(res)
    }).catch((err) => {
        ServeError(res,err.status,err.message)
    })
})

app.get("*",(req,res) => {
    ServeError(res,404,"Page not found.")
})

app.get("/server",(req,res) => {
    res.send(JSON.stringify({...config,version:pkg.version}))
})

// listen on 3000 or MONOFILE_PORT

app.listen(process.env.MONOFILE_PORT || 3000,function() {
    console.log("Web OK!")
})

client.login(process.env.TOKEN)