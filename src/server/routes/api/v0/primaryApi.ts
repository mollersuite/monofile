import bodyParser from "body-parser"
import { Hono } from "hono"

import * as Accounts from "../../../lib/accounts.js"
import * as auth from "../../../lib/auth.js"
import RangeParser, { type Range } from "range-parser"
import ServeError from "../../../lib/errors.js"
import Files, { WebError } from "../../../lib/files.js"
import { getAccount, requiresPermissions } from "../../../lib/middleware.js"
import {Readable} from "node:stream"
import {ReadableStream as StreamWebReadable} from "node:stream/web"
import formidable from "formidable"
import { HttpBindings } from "@hono/node-server"
export let primaryApi = new Hono<{
    Variables: {
        account: Accounts.Account
    },
    Bindings: HttpBindings
}>()

primaryApi.all("*", getAccount)

export default function (files: Files) {
    primaryApi.get(
        "/file/:fileId",
        async (ctx): Promise<Response> => {
            const fileId = (ctx.req.param() as {fileId: string}).fileId

            let acc = ctx.get("account") as Accounts.Account

            let file = files.files[fileId]
            ctx.header("Access-Control-Allow-Origin", "*")
            ctx.header("Content-Security-Policy", "sandbox allow-scripts")
            ctx.header("Content-Disposition", `${ctx.req.query("attachment") == "1" ? "attachment" : "inline"}; filename="${file.filename.replaceAll("\n","\\n")}"`)

            if (file) {
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
                        }
                    }
                }

                return files
                    .readFileStream(fileId, range)
                    .then(async (stream) => {
                        if (range) {
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

                        return ctx.req.method == "HEAD" ? ctx.body(null) : ctx.stream(async (webStream) => {
                            webStream.pipe(Readable.toWeb(stream) as ReadableStream).catch(e => {}) // emits an AbortError for some reason so this catches that
                        })
                    })
                    .catch((err) => {
                        return ServeError(ctx, err.status, err.message)
                    })
            } else {
                return ServeError(ctx, 404, "file not found")
            }
        }
    )
    // upload handlers

    primaryApi.post(
        "/upload",
        requiresPermissions("upload"),
        (ctx) => { return new Promise((resolve,reject) => {
            ctx.env.incoming.removeAllListeners("data") // remove hono's buffering

            let errEscalated = false
            function escalate(err:Error) {
                if (errEscalated) return
                errEscalated = true
                
                if ("httpCode" in err)
                    ctx.status(err.httpCode as number)
                else if (err instanceof WebError) 
                    ctx.status(err.statusCode)
                else ctx.status(400)
                resolve(ctx.body(err.message))
            }

            let acc = ctx.get("account") as Accounts.Account | undefined

            if (!ctx.req.header("Content-Type")?.startsWith("multipart/form-data")) {
                ctx.status(400)
                resolve(ctx.body("[err] must be multipart/form-data"))
                return
            }

            if (!ctx.req.raw.body) {
                ctx.status(400)
                resolve(ctx.body("[err] body must be supplied"))
                return
            }

            let file = files.createWriteStream(acc?.id)
            let parser = formidable({
                maxFieldsSize: 65536,
                maxFileSize: files.config.maxDiscordFileSize*files.config.maxDiscordFiles,
                maxFiles: 1
            })

            parser.onPart = function(part) {
                if (!part.originalFilename || !part.mimetype) {
                    parser._handlePart(part)
                    return
                }
                // lol
                if (part.name == "file") {
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

            parser.on("field", (k,v) => {
                if (k == "uploadId")
                    file.setUploadId(v)
            })

            parser.parse(ctx.env.incoming).catch(e => console.error(e))

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
/*
    primaryApi.post(
        "/clone",
        requiresPermissions("upload"),
        async ctx => {
            let acc = ctx.get("account") as Accounts.Account

            try {
                return axios
                    .get(req.body.url, { responseType: "arraybuffer" })
                    .then((data: AxiosResponse) => {
                        files
                            .uploadFile(
                                {
                                    owner: acc?.id,
                                    filename:
                                        req.body.url.split("/")[
                                            req.body.url.split("/").length - 1
                                        ] || "generic",
                                    mime: data.headers["content-type"],
                                    uploadId: req.body.uploadId,
                                },
                                Buffer.from(data.data)
                            )
                            .then((uID) => res.send(uID))
                            .catch((stat) => {
                                res.status(stat.status)
                                res.send(`[err] ${stat.message}`)
                            })
                    })
                    .catch((err) => {
                        console.log(err)
                        return res.text(`[err] failed to fetch data`, 400)
                    })
            } catch {
                return ctx.text("[err] an error occured", 500)
            }
        }
    )
    */
    return primaryApi
}
