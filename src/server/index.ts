import cookieParser from "cookie-parser";
import { IntentsBitField, Client } from "discord.js"
import express from "express"
import fs from "fs"
import bytes from "bytes";

import ServeError from "./lib/errors"
import Files from "./lib/files"
import * as auth from "./lib/auth"
import * as Accounts from "./lib/accounts"
import { getAccount } from "./lib/middleware";

import APIRouter from "./routes/api"

require("dotenv").config()

let pkg = require(`${process.cwd()}/package.json`)
let app = express()
let config = require(`${process.cwd()}/config.json`)

app.use("/static/assets",express.static("assets"))
app.use("/static/style",express.static("out/style"))
app.use("/static/js",express.static("out/client"))

//app.use(bodyParser.text({limit:(config.maxDiscordFileSize*config.maxDiscordFiles)+1048576,type:["application/json","text/plain"]}))

app.use(cookieParser())

// check for ssl, if not redirect
if (config.trustProxy) app.enable("trust proxy")
if (config.forceSSL) {
    app.use((req,res,next) => {
        if (req.protocol == "http") res.redirect(`https://${req.get("host")}${req.originalUrl}`)
        else next()
    })
}

app.get("/server",(req,res) => {
    res.send(JSON.stringify({
        ...config,
        version:pkg.version,
        files:Object.keys(files.files).length
    }))
})

// funcs

// init data

if (!fs.existsSync(__dirname+"/../.data/")) fs.mkdirSync(__dirname+"/../.data/")

// discord

let client = new Client({intents:[
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent
],rest:{timeout:config.requestTimeout}})

let files = new Files(client,config)

let apiRouter = new APIRouter(files)
apiRouter.loadAPIMethods().then(() => {
    app.use(apiRouter.root)
    console.log("API OK!")
})

// index, clone

app.get("/", function(req,res) {
    res.sendFile(process.cwd()+"/pages/index.html")
})

// serve download page

app.get("/download/:fileId", getAccount, (req,res) => {
    
    let acc = res.locals.acc as Accounts.Account

    if (files.getFilePointer(req.params.fileId)) {
        let file = files.getFilePointer(req.params.fileId)

        if (file.visibility == "private" && acc?.id != file.owner) {
            ServeError(res,403,"you do not own this file")
            return
        }

        fs.readFile(process.cwd()+"/pages/download.html",(err,buf) => {
            let fileOwner = file.owner ? Accounts.getFromId(file.owner) : undefined;
            if (err) {res.sendStatus(500);console.log(err);return}
            res.send(
                buf.toString()
                .replace(/\$FileId/g,req.params.fileId)
                .replace(/\$Version/g,pkg.version)
                .replace(/\$FileSize/g,file.sizeInBytes ? bytes(file.sizeInBytes) : "[File size unknown]")
                .replace(/\$FileName/g,
                    file.filename
                        .replace(/\&/g,"&amp;")
                        .replace(/\</g,"&lt;")
                        .replace(/\>/g,"&gt;")
                )
                .replace(/\<\!\-\-metaTags\-\-\>/g,
                    (
                        file.mime.startsWith("image/") 
                        ? `<meta name="og:image" content="https://${req.headers.host}/file/${req.params.fileId}" />` 
                        : (
                            file.mime.startsWith("video/")
                            ? (
                                `<meta property="og:video:url" content="https://${req.headers.host}/cpt/${req.params.fileId}/video.${file.mime.split("/")[1] == "quicktime" ? "mov" : file.mime.split("/")[1]}" />
                                <meta property="og:video:secure_url" content="https://${req.headers.host}/cpt/${req.params.fileId}/video.${file.mime.split("/")[1] == "quicktime" ? "mov" : file.mime.split("/")[1]}" />
                                <meta property="og:type" content="video.other">
                                <!-- honestly probably good enough for now -->
                                <meta property="twitter:image" content="0">`
                                // quick lazy fix as a fallback
                                // maybe i'll improve this later, but probably not.
                                + ((file.sizeInBytes||0) >= 26214400 ? `
                                <meta property="og:video:width" content="1280">
                                <meta property="og:video:height" content="720">` : "")
                            )
                            : ""
                        )
                    )
                    + (
                        fileOwner?.embed?.largeImage && file.visibility!="anonymous" && file.mime.startsWith("image/")
                        ? `<meta name="twitter:card" content="summary_large_image">`
                        : ""
                    )
                    + `\n<meta name="theme-color" content="${fileOwner?.embed?.color && file.visibility!="anonymous" && (req.headers["user-agent"]||"").includes("Discordbot") ? `#${fileOwner.embed.color}` : "rgb(30, 33, 36)"}">`
                )
                .replace(/\<\!\-\-preview\-\-\>/g,
                    file.mime.startsWith("image/") 
                    ? `<div style="min-height:10px"></div><img src="/file/${req.params.fileId}" />` 
                    : (
                        file.mime.startsWith("video/")
                        ? `<div style="min-height:10px"></div><video src="/file/${req.params.fileId}" controls></video>`
                        : (
                            file.mime.startsWith("audio/")
                            ? `<div style="min-height:10px"></div><audio src="/file/${req.params.fileId}" controls></audio>`
                            : ""
                        )
                    )
                )
                .replace(/\$Uploader/g,!file.owner||file.visibility=="anonymous" ? "Anonymous" : `@${fileOwner?.username || "Deleted User"}`)
            )
        })
    } else {
        ServeError(res,404,"file not found")
    }
})


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
