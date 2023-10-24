import { Hono } from "hono"
import * as Accounts from "../../../lib/accounts"
import { writeFile } from "fs/promises"
import Files from "../../../lib/files"
import {
    getAccount,
    requiresAccount,
    requiresPermissions,
} from "../../../lib/middleware"

export let fileApiRoutes = new Hono<{
    Variables: {
        account: Accounts.Account
    }
}>()

let config = require(`${process.cwd()}/config.json`)
fileApiRoutes.use("*", getAccount) // :warning: /list somehow crashes Hono with an internal error!
/*

/home/jack/Code/Web/monofile/node_modules/.pnpm/@hono+node-server@1.2.0/node_modules/@hono/node-server/dist/listener.js:55
    const contentType = res.headers.get("content-type") || "";
                                    ^

TypeError: Cannot read properties of undefined (reading 'get')
    at Server.<anonymous> (/home/jack/Code/Web/monofile/node_modules/.pnpm/@hono+node-server@1.2.0/node_modules/@hono/node-server/dist/listener.js:55:37)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
*/

module.exports = function (files: Files) {
    fileApiRoutes.get(
        "/list",
        requiresAccount,
        requiresPermissions("user"),
        async (ctx) => {
            let acc = ctx.get("account") as Accounts.Account

            if (!acc) return
            let accId = acc.id

            ctx.json(
                acc.files
                    .map((e) => {
                        let fp = files.getFilePointer(e)
                        if (!fp) {
                            Accounts.files.deindex(accId, e)
                            return null
                        }
                        return {
                            ...fp,
                            messageids: null,
                            owner: null,
                            id: e,
                        }
                    })
                    .filter((e) => e)
            )
        }
    )

    fileApiRoutes.post(
        "/manage",
        requiresPermissions("manage"),
        async (ctx) => {
            let acc = ctx.get("account") as Accounts.Account
            const body = await ctx.req.json()
            if (!acc) return
            if (
                !body.target ||
                !(typeof body.target == "object") ||
                body.target.length < 1
            )
                return

            let modified = 0

            body.target.forEach((e: string) => {
                if (!acc.files.includes(e)) return

                let fp = files.getFilePointer(e)

                if (fp.reserved) {
                    return
                }

                switch (body.action) {
                    case "delete":
                        files.unlink(e, true)
                        modified++
                        break

                    case "changeFileVisibility":
                        if (
                            !["public", "anonymous", "private"].includes(
                                body.value
                            )
                        )
                            return
                        files.files[e].visibility = body.value
                        modified++
                        break

                    case "setTag":
                        if (!body.value) delete files.files[e].tag
                        else {
                            if (body.value.toString().length > 30) return
                            files.files[e].tag = body.value
                                .toString()
                                .toLowerCase()
                        }
                        modified++
                        break
                }
            })

            return Accounts.save()
                .then(() => {
                    writeFile(
                        process.cwd() + "/.data/files.json",
                        JSON.stringify(files.files)
                    )
                })
                .then(() => ctx.text(`modified ${modified} files`))
                .catch((err) => console.error(err))
        }
    )

    return fileApiRoutes
}
