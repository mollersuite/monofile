import bodyParser from "body-parser"
import { Hono } from "hono"

import * as Accounts from "../../../lib/accounts.js"
import * as auth from "../../../lib/auth.js"
import RangeParser, { type Range } from "range-parser"
import ServeError from "../../../lib/errors.js"
import Files from "../../../lib/files.js"
import { getAccount } from "../../../lib/middleware.js"
import {Readable} from "node:stream"
export let primaryApi = new Hono<{
    Variables: {
        account: Accounts.Account
    }
}>()

primaryApi.use(getAccount)

export default function (files: Files) {
    primaryApi.get(
        "/file/:fileId",
        async (ctx): Promise<Response> => {
            const fileId = (ctx.req.param() as {fileId: string}).fileId

            let acc = ctx.get("account") as Accounts.Account

            let file = files.files[fileId]
            ctx.header("Access-Control-Allow-Origin", "*")
            ctx.header("Content-Security-Policy", "sandbox allow-scripts")
            if (ctx.req.query("attachment") == "1")
                ctx.header("Content-Disposition", "attachment")

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

    // primaryApi.head(
    //     ["/file/:fileId", "/cpt/:fileId/*", "/:fileId"],
    //     async (ctx) => {
    //         let file = files.files[req.params.fileId]

    //         if (
    //             file.visibility == "private" &&
    //             (ctx.get("account")?.id != file.owner ||
    //                 (auth.getType(auth.tokenFor(ctx)!) == "App" &&
    //                     auth
    //                         .getPermissions(auth.tokenFor(ctx)!)
    //                         ?.includes("private")))
    //         ) {
    //             return ctx.status(403)
    //         }

    //         ctx.header("Content-Security-Policy", "sandbox allow-scripts")

    //         if (ctx.req.query("attachment") == "1")
    //             ctx.header("Content-Disposition", "attachment")

    //         if (!file) {
    //             res.status(404)
    //             res.send()
    //         } else {
    //             ctx.header("Content-Type", file.mime)
    //             if (file.sizeInBytes) {
    //                 ctx.header("Content-Length", file.sizeInBytes)
    //             }
    //             if (file.chunkSize) {
    //                 ctx.header("Accept-Ranges", "bytes")
    //             }
    //             res.send()
    //         }
    //     }
    // )

    // upload handlers

    /*
    primaryApi.post(
        "/upload",
        requiresPermissions("upload"),
        multerSetup.single("file"),
        async (ctx) => {
            let acc = ctx.get("account") as Accounts.Account

            if (req.file) {
                try {
                    let prm = req.header("monofile-params")
                    let params: { [key: string]: any } = {}
                    if (prm) {
                        params = JSON.parse(prm)
                    }

                    files
                        .uploadFile(
                            {
                                owner: acc?.id,

                                uploadId: params.uploadId,
                                filename: req.file.originalname,
                                mime: req.file.mimetype,
                            },
                            req.file.buffer
                        )
                        .then((uID) => res.send(uID))
                        .catch((stat) => {
                            res.status(stat.status)
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
        }
    )

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
