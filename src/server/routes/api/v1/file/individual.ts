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

export default function(files: Files, apiRoot: Hono) {

    router.get("/:id", async (ctx) => {
        const fileId = ctx.req.param("id")

        let acc = ctx.get("account") as Accounts.Account

        let file = files.files[fileId]
        ctx.header("Accept-Ranges", "bytes")
        ctx.header("Access-Control-Allow-Origin", "*")
        ctx.header("Content-Security-Policy", "sandbox allow-scripts")

        if (file) {
            ctx.header("Content-Disposition", `${ctx.req.query("attachment") == "1" ? "attachment" : "inline"}; filename="${encodeURI(file.filename.replaceAll("\n","\\n"))}"`)
            ctx.header("ETag", file.md5)
            if (file.lastModified) {
                let lm = new Date(file.lastModified)
                // TERRIFYING
                ctx.header("Last-Modified", 
                    `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][lm.getUTCDay()]}, ${lm.getUTCDate()} `
                    + `${['Jan','Feb','Mar','Apr','May','Jun',"Jul",'Aug','Sep','Oct','Nov','Dec'][lm.getUTCMonth()]}`
                    + ` ${lm.getUTCFullYear()} ${lm.getUTCHours().toString().padStart(2,"0")}`
                    + `:${lm.getUTCMinutes().toString().padStart(2,"0")}:${lm.getUTCSeconds().toString().padStart(2,"0")} GMT`
                )
            }
            
            if (file.visibility == "private") {
                if (acc?.id != file.owner) {
                    return ServeError(ctx, 403, "you do not own this file")
                }

                if (
                    auth.getType(auth.tokenFor(ctx)!) == "App" &&
                    auth
                        .getPermissions(auth.tokenFor(ctx)!)
                        ?.includes("private")
                ) {
                    return ServeError(ctx, 403, "insufficient permissions")
                }
            }

            let range: Range | undefined

            ctx.header("Content-Type", file.mime)
            if (file.sizeInBytes) {
                ctx.header("Content-Length", file.sizeInBytes.toString())

                if (file.chunkSize && ctx.req.header("Range")) {
                    let ranges = RangeParser(file.sizeInBytes, ctx.req.header("Range") || "")

                    if (ranges) {
                        if (typeof ranges == "number")
                            return ServeError(ctx, ranges == -1 ? 416 : 400, ranges == -1 ? "unsatisfiable ranges" : "invalid ranges")
                        if (ranges.length > 1) return ServeError(ctx, 400, "multiple ranges not supported")
                        range = ranges[0]
                    
                        ctx.status(206)
                        ctx.header(
                            "Content-Length",
                            (range.end - range.start + 1).toString()
                        )
                        ctx.header(
                            "Content-Range",
                            `bytes ${range.start}-${range.end}/${file.sizeInBytes}`
                        )
                    }
                }
            }

            if (ctx.req.method == "HEAD")
                return ctx.body(null)

            return files
                .readFileStream(fileId, range)
                .then(async (stream) => {
                    let rs = new ReadableStream({
                        start(controller) {
                            stream.once("end", () => controller.close())
                            stream.once("error", (err) => controller.error(err))
                        },
                        cancel(reason) {
                            stream.destroy(reason instanceof Error ? reason : new Error(reason))
                        }
                    })
                    stream.pipe(ctx.env.outgoing)
                    return new Response(rs, ctx.body(null))
                })
                .catch((err) => {
                    return ServeError(ctx, err.status, err.message)
                })
        } else {
            return ServeError(ctx, 404, "file not found")
        }
    })

    router.on(["PUT", "POST"], "/:id", async (ctx) => {
        ctx.env.incoming.push(
            `--${ctx.req.header("content-type")?.match(/boundary=(\S+)/)?.[1]}\r\n`
            + `Content-Disposition: form-data; name="uploadId"\r\n\r\n`
            + ctx.req.param("id")
            + "\r\n"
        )

        return apiRoot.fetch(
            new Request(
                (new URL(
                    `/api/v1/file`, ctx.req.raw.url)).href, 
                    ctx.req.raw
            ), 
            ctx.env
        )
    })

    return router
}
