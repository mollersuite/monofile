import bodyParser from "body-parser"
import multer, {memoryStorage} from "multer"
import cookieParser from "cookie-parser";
import Discord, { IntentsBitField, Client } from "discord.js"
import express from "express"
import fs, { link } from "fs"
import axios, { AxiosResponse } from "axios"

import ServeError from "./lib/errors"
import Files from "./lib/files"
import * as auth from "./lib/auth"
import * as Accounts from "./lib/accounts"

import { authRoutes } from "./routes/authRoutes";
require("dotenv").config()

const multerSetup = multer({storage:memoryStorage()})
let pkg = require(`${process.cwd()}/package.json`)
let app = express()
let config = require(`${process.cwd()}/config.json`)

app.use("/static/assets",express.static("assets"))
app.use("/static/style",express.static("out/style"))
app.use("/static/js",express.static("out/client"))

app.use(bodyParser.text({limit:(config.maxDiscordFileSize*config.maxDiscordFiles)+1048576,type:["application/json","text/plain"]}))
app.use(cookieParser())

app.use("/auth",authRoutes)
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
    res.sendFile(process.cwd()+"/pages/index.html")
})

// upload handlers

app.post("/upload",multerSetup.single('file'),async (req,res) => {
    if (req.file) {
        try {
            let prm = req.header("monofile-params")
            let params:{[key:string]:any} = {}
            if (prm) {
                params = JSON.parse(prm)
            }

            files.uploadFile({
                owner: auth.validate(req.cookies.auth),

                uploadId:params.uploadId,
                name:req.file.originalname,
                mime:req.file.mimetype
            },req.file.buffer)
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

            files.uploadFile({
                owner: auth.validate(req.cookies.auth),

                name:j.url.split("/")[req.body.split("/").length-1] || "generic",
                mime:data.headers["content-type"],
                uploadId:j.uploadId
            },Buffer.from(data.data))
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

        fs.readFile(process.cwd()+"/pages/download.html",(err,buf) => {
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
                .replace(/\$metaTags/g,
                    file.mime.startsWith("image/") 
                    ? `<meta name="og:image" content="https://${req.headers.host}/file/${req.params.fileId}" />` 
                    : (
                        file.mime.startsWith("video/")
                        ? `<meta name="og:video:url" content="https://${req.headers.host}/file/${req.params.fileId}" />\n<meta name="og:video:type" content="${file.mime.replace(/\"/g,"")}">`
                        : ""
                    )
                )
            )
        })
    } else {
        ServeError(res,404,"file not found")
    }
})

let fgRQH = async (req:express.Request,res:express.Response) => {
    files.readFileStream(req.params.fileId).then(f => {
        res.setHeader("Content-Type",f.contentType)
        res.status(200)
        f.dataStream.pipe(res)
    }).catch((err) => {
        ServeError(res,err.status,err.message)
    })
}

app.get("/server",(req,res) => {
    res.send(JSON.stringify({
        ...config,
        version:pkg.version,
        files:Object.keys(files.files).length
    }))
})

app.get("/file/:fileId",fgRQH)
app.get("/:fileId",fgRQH)

/*
    routes should be in this order:
    
    index
    api
    dl pages
    file serving
*/

// listen on 3000 or MONOFILE_PORT

app.listen(process.env.MONOFILE_PORT || 3000,function() {
    console.log("Web OK!")
})

client.login(process.env.TOKEN)