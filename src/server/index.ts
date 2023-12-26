import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { Hono } from "hono"
import fs from "fs"
import { readFile } from "fs/promises"
import Files from "./lib/files"
import { getAccount } from "./lib/middleware"
import APIRouter from "./routes/api"
import preview from "./routes/preview"

const pkg = require(`${process.cwd()}/package.json`)
const app = new Hono()
let config = require(`${process.cwd()}/config.json`)

app.get(
    "/static/assets/*",
    serveStatic({
        rewriteRequestPath: (path) => {
            return path.replace("/static/assets", "/assets")
        },
    })
)
app.get(
    "/static/vite/*",
    serveStatic({
        rewriteRequestPath: (path) => {
            return path.replace("/static/vite", "/dist/static/vite")
        },
    })
)

// respond to the MOLLER method
// get it?
// haha...

app.on(["MOLLER"], "*", async (ctx) => {

    ctx.header("Content-Type", "image/webp")
    return ctx.body( await readFile("./assets/moller.png") )
    
})

//app.use(bodyParser.text({limit:(config.maxDiscordFileSize*config.maxDiscordFiles)+1048576,type:["application/json","text/plain"]}))

// check for ssl, if not redirect
if (config.trustProxy) {
    // app.enable("trust proxy")
}
if (config.forceSSL) {
    app.use(async (ctx, next) => {
        if (new URL(ctx.req.url).protocol == "http") {
            return ctx.redirect(
                `https://${ctx.req.header("host")}${
                    new URL(ctx.req.url).pathname
                }`
            )
        } else {
            return next()
        }
    })
}

app.get("/server", (ctx) =>
    ctx.json({
        ...config,
        version: pkg.version,
        files: Object.keys(files.files).length,
    })
)

// funcs

// init data

if (!fs.existsSync(__dirname + "/../.data/"))
    fs.mkdirSync(__dirname + "/../.data/")

// discord
let files = new Files(config)

const apiRouter = new APIRouter(files)
apiRouter.loadAPIMethods().then(() => {
    app.route("/", apiRouter.root)
    console.log("API OK!")
})

// index, clone

app.get("/", async (ctx) =>
    ctx.html(
        await fs.promises.readFile(process.cwd() + "/dist/index.html", "utf-8")
    )
)

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

serve(
    {
        fetch: app.fetch,
        port: Number(process.env.MONOFILE_PORT || 3000),
    },
    (info) => {
        console.log("Web OK!", info.port, info.address)
    }
)

export = app
