import cookieParser from "cookie-parser"
import { IntentsBitField, Client } from "discord.js"
import express from "express"
import fs from "fs"
import Files from "./lib/files"
import { getAccount } from "./lib/middleware"

import APIRouter from "./routes/api"
import preview from "./preview"

require("dotenv").config()

const pkg = require(`${process.cwd()}/package.json`)
let app = express()
let config = require(`${process.cwd()}/config.json`)

app.use("/static/assets", express.static("assets"))
app.use("/static/vite", express.static("dist/static/vite"))

//app.use(bodyParser.text({limit:(config.maxDiscordFileSize*config.maxDiscordFiles)+1048576,type:["application/json","text/plain"]}))

app.use(cookieParser())

// check for ssl, if not redirect
if (config.trustProxy) app.enable("trust proxy")
if (config.forceSSL) {
    app.use((req, res, next) => {
        if (req.protocol == "http")
            res.redirect(`https://${req.get("host")}${req.originalUrl}`)
        else next()
    })
}

app.get("/server", (req, res) => {
    res.send(
        JSON.stringify({
            ...config,
            version: pkg.version,
            files: Object.keys(files.files).length,
        })
    )
})

// funcs

// init data

if (!fs.existsSync(__dirname + "/../.data/"))
    fs.mkdirSync(__dirname + "/../.data/")

// discord

let client = new Client({
    intents: [
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
    rest: { timeout: config.requestTimeout },
})

let files = new Files(client, config)

let apiRouter = new APIRouter(files)
apiRouter.loadAPIMethods().then(() => {
    app.use(apiRouter.root)
    console.log("API OK!")
})

// index, clone

app.get("/", function (req, res) {
    res.sendFile(process.cwd() + "/dist/index.html")
})

// serve download page

app.get("/download/:fileId", getAccount, preview(files))

/*
    routes should be in this order:
    
    index
    api
    dl pages
    file serving
*/

// listen on 3000 or MONOFILE_PORT

app.listen(process.env.MONOFILE_PORT || 3000, function () {
    console.log("Web OK!")
})

client.login(process.env.TOKEN)
