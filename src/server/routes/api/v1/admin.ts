// Modules

import { writeFile } from "fs/promises"
import { Hono } from "hono"

// Libs

import Files, { id_check_regex } from "../../../lib/files.js"
import * as Accounts from "../../../lib/accounts.js"
import * as Authentication from "../../../lib/auth.js"
import {
    getAccount,
    noAPIAccess,
    requiresAccount,
    requiresAdmin,
} from "../../../lib/middleware.js"
import ServeError from "../../../lib/errors.js"
import { sendMail } from "../../../lib/mail.js"

const router = new Hono<{
    Variables: {
        account?: Accounts.Account
    }
}>()

router.use(getAccount, requiresAccount, requiresAdmin)

export default function (files: Files) {
    router.patch("/account/:username/password", async (ctx) => {
        const Account = ctx.get("account") as Accounts.Account
        const body = await ctx.req.json()

        const targetUsername = ctx.req.param("username")
        const password = body.password

        if (typeof password !== "string") return ServeError(ctx, 404, "")

        const targetAccount = Accounts.getFromUsername(targetUsername)

        if (!targetAccount) return ServeError(ctx, 404, "")

        Accounts.password.set(targetAccount.id, password)

        Authentication.AuthTokens.filter(
            (e) => e.account == targetAccount?.id
        ).forEach((accountToken) => {
            Authentication.invalidate(accountToken.token)
        })

        if (targetAccount.email) {
            await sendMail(
                targetAccount.email,
                `Your login details have been updated`,
                `<b>Hello there!</b> This email is to notify you of a password change that an administrator, <span username>${Account.username}</span>, has initiated. You have been logged out of your devices. Thank you for using monofile.`
            ).catch()
        }

        return ctx.text("")
    })

    router.patch("/account/:username/elevate", (ctx) => {
        const targetUsername = ctx.req.param("username")
        const targetAccount = Accounts.getFromUsername(targetUsername)

        if (!targetAccount) {
            return ServeError(ctx, 404, "")
        }

        targetAccount.admin = true
        Accounts.save()

        return ctx.text("")
    })

    router.delete(
        "/account/:username/:deleteFiles",
        requiresAccount,
        noAPIAccess,
        async (ctx) => {
            const targetUsername = ctx.req.param("username")
            const deleteFiles = ctx.req.param("deleteFiles")

            const targetAccount = Accounts.getFromUsername(targetUsername)

            if (!targetAccount) return ServeError(ctx, 404, "")

            const accountId = targetAccount.id

            Authentication.AuthTokens.filter(
                (e) => e.account == accountId
            ).forEach((token) => {
                Authentication.invalidate(token.token)
            })

            const deleteAccount = () =>
                Accounts.deleteAccount(accountId).then((_) =>
                    ctx.text("account deleted")
                )

            if (deleteFiles) {
                const Files = targetAccount.files.map((e) => e)

                for (let fileId of Files) {
                    files.unlink(fileId, true).catch((err) => console.error)
                }

                await writeFile(
                    process.cwd() + "/.data/files.json",
                    JSON.stringify(files.files)
                )
                return deleteAccount()
            } else return deleteAccount()
        }
    )

    return router
}
