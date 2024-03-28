import { Hono } from "hono"
import * as Accounts from "../../../lib/accounts.js"
import { writeFile } from "fs/promises"
import Files from "../../../lib/files.js"
import {
    getAccount,
    requiresAccount,
    requiresPermissions,
} from "../../../lib/middleware.js"

export let fileApiRoutes = new Hono<{
    Variables: {
        account: Accounts.Account
    }
}>()

fileApiRoutes.use("*", getAccount)

export default function (files: Files) {
    fileApiRoutes.get(
        "/list",
        requiresAccount,
        requiresPermissions("user"),
        async (ctx) => {
            let acc = ctx.get("account") as Accounts.Account

            if (!acc) return
            let accId = acc.id

            return ctx.json(
                acc.files
                    .map((e) => {
                        let fp = files.files[e]
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

                let fp = files.files[e]

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
