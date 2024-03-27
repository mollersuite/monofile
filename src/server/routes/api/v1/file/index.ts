import { Hono } from "hono"
import * as Accounts from "../../../../lib/accounts.js"
import * as auth from "../../../../lib/auth.js"
import RangeParser, { type Range } from "range-parser"
import ServeError from "../../../../lib/errors.js"
import Files, { WebError } from "../../../../lib/files.js"
import { getAccount, requiresPermissions } from "../../../../lib/middleware.js"
import {Readable} from "node:stream"
import type {ReadableStream as StreamWebReadable} from "node:stream/web"
import formidable from "formidable"
import { HttpBindings } from "@hono/node-server"
import pkg from "../../../../../../package.json" assert {type: "json"}
import { type StatusCode } from "hono/utils/http-status"

const router = new Hono<{
    Variables: {
        account: Accounts.Account
    },
    Bindings: HttpBindings
}>()
router.all("*", getAccount)

export default function(files: Files) {
    
    router.on(
        ["PUT", "POST"],
        "/",
        requiresPermissions("upload"),
        (ctx) => { return new Promise((resolve,reject) => {
            ctx.env.incoming.removeAllListeners("data") // remove hono's buffering

            let errEscalated = false
            function escalate(err:Error) {
                if (errEscalated) return
                errEscalated = true
                console.error(err)
                
                if ("httpCode" in err)
                    ctx.status(err.httpCode as StatusCode)
                else if (err instanceof WebError) 
                    ctx.status(err.statusCode as StatusCode)
                else ctx.status(400)
                resolve(ctx.body(err.message))
            }

            let acc = ctx.get("account") as Accounts.Account | undefined

            if (!ctx.req.header("Content-Type")?.startsWith("multipart/form-data"))
                return resolve(ctx.body("must be multipart/form-data", 400))

            if (!ctx.req.raw.body)
                return resolve(ctx.body("body must be supplied", 400))

            let file = files.createWriteStream(acc?.id)
            let parser = formidable({
                maxFieldsSize: 65536,
                maxFileSize: files.config.maxDiscordFileSize*files.config.maxDiscordFiles,
                maxFiles: 1
            })

            let acceptNewData = true

            parser.onPart = function(part) {
                if (!part.originalFilename || !part.mimetype) {
                    parser._handlePart(part)
                    return
                }
                // lol
                if (part.name == "file") {
                    if (!acceptNewData || file.writableEnded) 
                        return part.emit("error", new WebError(400, "cannot set file after previously setting up another upload"))
                    acceptNewData = false
                    file.setName(part.originalFilename || "")
                    file.setType(part.mimetype || "")

                    file.on("drain", () => ctx.env.incoming.resume())
                    file.on("error", (err) => part.emit("error", err))

                    part.on("data", (data: Buffer) => {
                        if (!file.write(data))
                            ctx.env.incoming.pause()
                    })
                    part.on("end", () => file.end())
                }
            }

            parser.on("field", async (k,v) => {
                if (k == "uploadId") {
                    if (files.files[v] && ctx.req.method == "POST")
                        return file.destroy(new WebError(409, "file already exists"))
                    file.setUploadId(v)
                // I'M GONNA KILL MYSELF!!!!
                } else if (k == "file") {
                    if (!acceptNewData || file.writableEnded) 
                        return file.destroy(new WebError(400, "cannot set file after previously setting up another upload"))
                    acceptNewData = false

                    let res = await fetch(v, {
                        headers: {
                            "user-agent": `monofile ${pkg.version} (+https://${ctx.req.header("Host")})`
                        }
                    }).catch(escalate)

                    if (!res) return
                    
                    if (!file
                        .setName(
                            res.headers.get("Content-Disposition")
                                ?.match(/filename="(.*)"/)?.[1]
                            || v.split("/")[
                                v.split("/").length - 1
                            ] || "generic"
                        )) return
                    
                    if (res.headers.has("Content-Type"))
                            if (!file.setType(res.headers.get("Content-Type")!))
                                return

                    if (!res.ok) return file.destroy(new WebError(500, `got ${res.status} ${res.statusText}`))
                    if (!res.body) return file.destroy(new WebError(500, `Internal Server Error`))
                    if (
                        res.headers.has("Content-Length")
                        && !Number.isNaN(parseInt(res.headers.get("Content-Length")!,10))
                        && parseInt(res.headers.get("Content-Length")!,10) > files.config.maxDiscordFileSize*files.config.maxDiscordFiles
                    ) 
                        return file.destroy(new WebError(413, `file reports to be too large`))
                        
                    Readable.fromWeb(res.body as StreamWebReadable)
                        .pipe(file) 
                }
            })

            parser.parse(ctx.env.incoming)
                .catch(e => console.error(e))

            parser.on('error', (err) => {
                escalate(err)
                if (!file.destroyed) file.destroy(err)
            })
            file.on("error", escalate)

            file.on("finish", async () => {
                if (!ctx.env.incoming.readableEnded) await new Promise(res => ctx.env.incoming.once("end", res))
                file.commit()
                    .then(id => resolve(ctx.body(id!)))
                    .catch(escalate)
            })

        })}
    )

    return router
}
