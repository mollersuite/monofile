import fs from "fs/promises"
import bytes from "bytes"
import ServeError from "./lib/errors"
import * as Accounts from "./lib/accounts"
import type { Handler } from "express"
import type Files from "./lib/files"
const pkg = require(`${process.cwd()}/package.json`)
export = (files: Files): Handler =>
    async (req, res) => {
        let acc = res.locals.acc as Accounts.Account
        const file = files.getFilePointer(req.params.fileId)
        if (file) {
            if (file.visibility == "private" && acc?.id != file.owner) {
                ServeError(res, 403, "you do not own this file")
                return
            }

            const template = await fs
                .readFile(process.cwd() + "/pages/download.html", "utf8")
                .catch(() => {
                    throw res.sendStatus(500)
                })
            let fileOwner = file.owner
                ? Accounts.getFromId(file.owner)
                : undefined

            res.send(
                template
                    .replaceAll("$FileId", req.params.fileId)
                    .replaceAll("$Version", pkg.version)
                    .replaceAll(
                        "$FileSize",
                        file.sizeInBytes
                            ? bytes(file.sizeInBytes)
                            : "[File size unknown]"
                    )
                    .replaceAll(
                        "$FileName",
                        file.filename
                            .replaceAll("&", "&amp;")
                            .replaceAll("<", "&lt;")
                            .replaceAll(">", "&gt;")
                    )
                    .replace(
                        "<!--metaTags-->",
                        (file.mime.startsWith("image/")
                            ? `<meta name="og:image" content="https://${req.headers.host}/file/${req.params.fileId}" />`
                            : file.mime.startsWith("video/")
                            ? `<meta property="og:video:url" content="https://${
                                  req.headers.host
                              }/cpt/${req.params.fileId}/video.${
                                  file.mime.split("/")[1] == "quicktime"
                                      ? "mov"
                                      : file.mime.split("/")[1]
                              }" />
                                <meta property="og:video:secure_url" content="https://${
                                    req.headers.host
                                }/cpt/${req.params.fileId}/video.${
                                  file.mime.split("/")[1] == "quicktime"
                                      ? "mov"
                                      : file.mime.split("/")[1]
                              }" />
                                <meta property="og:type" content="video.other">
                                <!-- honestly probably good enough for now -->
                                <meta property="twitter:image" content="0">` +
                              // quick lazy fix as a fallback
                              // maybe i'll improve this later, but probably not.
                              ((file.sizeInBytes || 0) >= 26214400
                                  ? `
                                <meta property="og:video:width" content="1280">
                                <meta property="og:video:height" content="720">`
                                  : "")
                            : "") +
                            (fileOwner?.embed?.largeImage &&
                            file.visibility != "anonymous" &&
                            file.mime.startsWith("image/")
                                ? `<meta name="twitter:card" content="summary_large_image">`
                                : "") +
                            `\n<meta name="theme-color" content="${
                                fileOwner?.embed?.color &&
                                file.visibility != "anonymous" &&
                                (req.headers["user-agent"] || "").includes(
                                    "Discordbot"
                                )
                                    ? `#${fileOwner.embed.color}`
                                    : "rgb(30, 33, 36)"
                            }">`
                    )
                    .replace(
                        "<!--preview-->",
                        file.mime.startsWith("image/")
                            ? `<div style="min-height:10px"></div><img src="/file/${req.params.fileId}" />`
                            : file.mime.startsWith("video/")
                            ? `<div style="min-height:10px"></div><video src="/file/${req.params.fileId}" controls></video>`
                            : file.mime.startsWith("audio/")
                            ? `<div style="min-height:10px"></div><audio src="/file/${req.params.fileId}" controls></audio>`
                            : ""
                    )
                    .replaceAll(
                        "$Uploader",
                        !file.owner || file.visibility == "anonymous"
                            ? "Anonymous"
                            : `@${fileOwner?.username || "Deleted User"}`
                    )
            )
        } else {
            ServeError(res, 404, "file not found")
        }
    }
