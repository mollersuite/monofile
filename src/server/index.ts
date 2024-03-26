import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { Hono } from "hono"
import fs from "fs"
import { readFile } from "fs/promises"
import Files from "./lib/files.js"
import { getAccount } from "./lib/middleware.js"
import APIRouter from "./routes/api.js"
import preview from "./routes/api/web/preview.js"
import {fileURLToPath} from "url"
import {dirname} from "path"
import pkg from "../../package.json" assert {type:"json"}
import config from "../../config.json" assert {type:"json"}

const app = new Hono()

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

const __dirname = dirname(fileURLToPath(import.meta.url))
if (!fs.existsSync(__dirname + "/../.data/"))
    fs.mkdirSync(__dirname + "/../.data/")

// discord
let files = new Files(config)

const apiRouter = new APIRouter(files)
apiRouter.loadAPIMethods().then(() => {
    app.route("/", apiRouter.root)
    console.log("API OK!")

    // moved here to ensure it's matched last
    app.get("/:fileId", async (ctx) => 
        app.fetch(
            new Request(
                (new URL(
                    `/api/v1/file/${ctx.req.param("fileId")}`, ctx.req.raw.url)).href, 
                    ctx.req.raw
            ), 
            ctx.env
        )
    )

    // listen on 3000 or MONOFILE_PORT
    // moved here to prevent a crash if someone manages to access monofile before api routes are mounted
    
    serve(
        {
            fetch: app.fetch,
            port: Number(process.env.MONOFILE_PORT || 3000),
            serverOptions: {
                //@ts-ignore
                requestTimeout: config.requestTimeout
            }
        },
        (info) => {
            console.log("Web OK!", info.port, info.address)
        }
    )
})

// index, clone

app.get("/", async (ctx) =>
    ctx.html(
        await fs.promises.readFile(process.cwd() + "/dist/index.html", "utf-8")
    )
)

/*
    routes should be in this order:
    
    index
    api
    dl pages
    file serving
*/

export default app