import { Hono } from "hono"
import * as Accounts from "../../../lib/accounts"
import * as auth from "../../../lib/auth"
import { writeFile } from "fs/promises"
import { sendMail } from "../../../lib/mail"
import {
    getAccount,
    requiresAccount,
    requiresAdmin,
    requiresPermissions,
} from "../../../lib/middleware"
import Files from "../../../lib/files"

export let adminRoutes = new Hono<{
    Variables: {
        account: Accounts.Account
    }
}>()
adminRoutes
    .use(getAccount)
    .use(requiresAccount)
    .use(requiresAdmin)
    .use(requiresPermissions("admin"))

let config = require(`${process.cwd()}/config.json`)

module.exports = function (files: Files) {
    adminRoutes.post("/reset", async (ctx) => {
        let acc = ctx.get("account") as Accounts.Account
        const body = await ctx.req.json()

        if (
            typeof body.target !== "string" ||
            typeof body.password !== "string"
        ) {
            return ctx.status(404)
        }

        let targetAccount = Accounts.getFromUsername(body.target)
        if (!targetAccount) {
            return ctx.status(404)
        }

        Accounts.password.set(targetAccount.id, body.password)
        auth.AuthTokens.filter((e) => e.account == targetAccount?.id).forEach(
            (v) => {
                auth.invalidate(v.token)
            }
        )

        if (targetAccount.email) {
            return sendMail(
                targetAccount.email,
                `Your login details have been updated`,
                `<b>Hello there!</b> This email is to notify you of a password change that an administrator, <span username>${acc.username}</span>, has initiated. You have been logged out of your devices. Thank you for using monofile.`
            )
                .then(() => ctx.text("OK"))
                .catch(() => ctx.status(500))
        }
    })

    adminRoutes.post("/elevate", async (ctx) => {
        const body = await ctx.req.json()
        let acc = ctx.get("account") as Accounts.Account

        if (typeof body.target !== "string") {
            return ctx.status(404)
        }

        let targetAccount = Accounts.getFromUsername(body.target)
        if (!targetAccount) {
            return ctx.status(404)
        }

        Accounts.save()
        return ctx.text("OK")
    })

    adminRoutes.post("/delete", async (ctx) => {
        const body = await ctx.req.json()
        if (typeof body.target !== "string") {
            return ctx.status(404)
        }

        let targetFile = files.files[body.target]

        if (!targetFile) {
            return ctx.status(404)
        }

        return files
            .unlink(body.target)
            .then(() => ctx.status(200))
            .catch(() => ctx.status(500))
            .finally(() => ctx.status(200))
    })

    adminRoutes.post("/delete_account", async (ctx) => {
        let acc = ctx.get("account") as Accounts.Account
        const body = await ctx.req.json()
        if (typeof body.target !== "string") {
            return ctx.status(404)
        }

        let targetAccount = Accounts.getFromUsername(body.target)
        if (!targetAccount) {
            return ctx.status(404)
        }

        let accId = targetAccount.id

        auth.AuthTokens.filter((e) => e.account == accId).forEach((v) => {
            auth.invalidate(v.token)
        })

        let cpl = () =>
            Accounts.deleteAccount(accId).then((_) => {
                if (targetAccount?.email) {
                    sendMail(
                        targetAccount.email,
                        "Notice of account deletion",
                        `Your account, <span username>${
                            targetAccount.username
                        }</span>, has been deleted by <span username>${
                            acc.username
                        }</span> for the following reason: <br><br><span style="font-weight:600">${
                            body.reason || "(no reason specified)"
                        }</span><br><br> Your files ${
                            body.deleteFiles
                                ? "have been deleted"
                                : "have not been modified"
                        }. Thank you for using monofile.`
                    )
                }
                return ctx.text("account deleted")
            })

        if (body.deleteFiles) {
            let f = targetAccount.files.map((e) => e) // make shallow copy so that iterating over it doesnt Die
            for (let v of f) {
                files.unlink(v, true).catch((err) => console.error(err))
            }

            return writeFile(
                process.cwd() + "/.data/files.json",
                JSON.stringify(files.files)
            ).then(cpl)
        } else return cpl()
    })

    adminRoutes.post("/transfer", async (ctx) => {
        const body = await ctx.req.json()
        if (typeof body.target !== "string" || typeof body.owner !== "string") {
            return ctx.status(404)
        }

        let targetFile = files.files[body.target]
        if (!targetFile) {
            return ctx.status(404)
        }

        let newOwner = Accounts.getFromUsername(body.owner || "")

        // clear old owner

        if (targetFile.owner) {
            let oldOwner = Accounts.getFromId(targetFile.owner)
            if (oldOwner) {
                Accounts.files.deindex(oldOwner.id, body.target)
            }
        }

        if (newOwner) {
            Accounts.files.index(newOwner.id, body.target)
        }
        targetFile.owner = newOwner ? newOwner.id : undefined

        files
            .write()
            .then(() => ctx.status(200))
            .catch(() => ctx.status(500))
    })

    adminRoutes.post("/idchange", async (ctx) => {
        const body = await ctx.req.json()
        if (typeof body.target !== "string" || typeof body.new !== "string") {
            return ctx.status(400)
        }

        let targetFile = files.files[body.target]
        if (!targetFile) {
            return ctx.status(404)
        }

        if (files.files[body.new]) {
            return ctx.status(400)
        }

        if (targetFile.owner) {
            Accounts.files.deindex(targetFile.owner, body.target)
            Accounts.files.index(targetFile.owner, body.new)
        }
        delete files.files[body.target]
        files.files[body.new] = targetFile

        return files
            .write()
            .then(() => ctx.status(200))
            .catch(() => {
                files.files[body.target] = body.new

                if (targetFile.owner) {
                    Accounts.files.deindex(targetFile.owner, body.new)
                    Accounts.files.index(targetFile.owner, body.target)
                }

                return ctx.status(500)
            })
    })

    return adminRoutes
}
