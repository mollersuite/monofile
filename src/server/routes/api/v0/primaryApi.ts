import bodyParser from "body-parser"
import { Hono } from "hono"

import * as Accounts from "../../../lib/accounts"
import * as auth from "../../../lib/auth"
import axios, { AxiosResponse } from "axios"
import { type Range } from "range-parser"
import multer, { memoryStorage } from "multer"
import { Readable } from "stream"
import ServeError from "../../../lib/errors"
import Files from "../../../lib/files"
import { getAccount, requiresPermissions } from "../../../lib/middleware"

let parser = bodyParser.json({
    type: ["text/plain", "application/json"],
})

export let primaryApi = new Hono<{
    Variables: {
        account: Accounts.Account
    }
}>()

const multerSetup = multer({ storage: memoryStorage() })

let config = require(`${process.cwd()}/config.json`)

primaryApi.use(getAccount)

module.exports = function (files: Files) {
    primaryApi.get(
        ["/file/:fileId", "/cpt/:fileId/*", "/:fileId"],
        async (ctx) => {
            const fileId = (ctx.req.param() as {fileId: string}).fileId
            const reqRange 

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
                        ServeError(ctx, 403, "insufficient permissions")
                        return
                    }
                }

                let range: Range | undefined

                ctx.header("Content-Type", file.mime)
                if (file.sizeInBytes) {
                    ctx.header("Content-Length", file.sizeInBytes.toString())

                    if (file.chunkSize) {
                        let range = ctx.range(file.sizeInBytes)
                        if (range) {
                            // error handling
                            if (typeof range == "number") {
                                return ctx.status(range == -1 ? 416 : 400)
                            }
                            if (range.type != "bytes") {
                                return ctx.status(400)
                            }

                            // set ranges var
                            let rngs = Array.from(range)
                            if (rngs.length != 1) {
                                return ctx.status(400)
                            }
                            range = rngs[0]
                        }
                    }
                }

                // supports ranges

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

                        return ctx.stream((stre) => {
                            // Somehow return a stream?
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
