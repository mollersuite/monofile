// Modules


import { Hono } from "hono"
import { getCookie, setCookie } from "hono/cookie"

// Libs

import Files, { id_check_regex } from "../../../lib/files.js"
import * as Accounts from "../../../lib/accounts.js"
import * as auth from "../../../lib/auth.js"
import {
    assertAPI,
    getAccount,
    noAPIAccess,
    requiresAccount,
    requiresPermissions,
} from "../../../lib/middleware.js"
import ServeError from "../../../lib/errors.js"
import { sendMail } from "../../../lib/mail.js"

import Configuration from "../../../../../config.json" assert {type:"json"}

const router = new Hono<{
    Variables: {
        account: Accounts.Account
    }
}>()

router.use(getAccount)

export default function (files: Files) {
    router.post("/login", async (ctx, res) => {
        const body = await ctx.req.json()
        if (
            typeof body.username != "string" ||
            typeof body.password != "string"
        ) {
            ServeError(ctx, 400, "please provide a username or password")
            return
        }

        if (auth.validate(getCookie(ctx, "auth")!)) {
            ServeError(ctx, 400, "you are already logged in")
            return
        }

        const account = Accounts.getFromUsername(body.username)

        if (!account || !Accounts.password.check(account.id, body.password)) {
            ServeError(ctx, 400, "username or password incorrect")
            return
        }
        setCookie(ctx, "auth", auth.create(account.id, 3 * 24 * 60 * 60 * 1000), {
            path: "/",
            sameSite: "Strict",
            secure: true,
            httpOnly: true
        })
        ctx.status(200)
    })

    router.post("/create", async (ctx) => {
        const body = await ctx.req.json()
        if (!Configuration.accounts.registrationEnabled) {
            return ServeError(ctx, 403, "account registration disabled")
        }

        if (auth.validate(getCookie(ctx, "auth")!)) {
            return ServeError(ctx, 400, "you are already logged in")
        }

        if (Accounts.getFromUsername(body.username)) {
            return ServeError(
                ctx,
                400,
                "account with this username already exists"
            )
        }

        if (body.username.length < 3 || body.username.length > 20) {
            return ServeError(
                ctx,
                400,
                "username must be over or equal to 3 characters or under or equal to 20 characters in length"
            )
        }

        if (
            (body.username.match(/[A-Za-z0-9_\-\.]+/) || [])[0] != body.username
        ) {
            return ServeError(ctx, 400, "username contains invalid characters")
        }

        if (body.password.length < 8) {
            return ServeError(
                ctx,
                400,
                "password must be 8 characters or longer"
            )
        }

        return Accounts.create(body.username, body.password)
            .then((account) => {
                setCookie(ctx, "auth", auth.create(account, 3 * 24 * 60 * 60 * 1000), {
                    path: "/",
                    sameSite: "Strict",
                    secure: true,
                    httpOnly: true
                })
                return ctx.status(200)
            })
            .catch(() => {
                return ServeError(ctx, 500, "internal server error")
            })
    })

    router.post("/logout", (ctx) => {
        if (!auth.validate(getCookie(ctx, "auth")!)) {
            return ServeError(ctx, 401, "not logged in")
        }

        auth.invalidate(getCookie(ctx, "auth")!)
        return ctx.text("logged out")
    })

    router.put(
        "/dfv",
        requiresAccount,
        requiresPermissions("manage"),
        async (ctx) => {
            const body = await ctx.req.json()
            const Account = ctx.get("account")! as Accounts.Account

            if (
                ["public", "private", "anonymous"].includes(
                    body.defaultFileVisibility
                )
            ) {
                Account.defaultFileVisibility = body.defaultFileVisibility

                Accounts.save()

                return ctx.text(
                    `dfv has been set to ${Account.defaultFileVisibility}`
                )
            } else {
                return ServeError(ctx, 400, "invalid dfv")
            }
        }
    )

    router.delete("/:user", requiresAccount, noAPIAccess, async (ctx) => {
        let acc = ctx.req.param("user") == "me" ? ctx.get("account") : Accounts.getFromId(ctx.req.param("user"))
        if (acc != ctx.get("account") && !ctx.get("account")?.admin) return ServeError(ctx, 403, "you are not an administrator")
        if (!acc) return ServeError(ctx, 404, "account does not exist")
        const Account = ctx.get("account") as Accounts.Account
        const accountId = Account.id

        auth.AuthTokens.filter((e) => e.account == accountId).forEach(
            (token) => {
                auth.invalidate(token.token)
            }
        )

        if (acc.email) {
            await sendMail(
                acc.email,
                "Notice of account deletion",
                `Your account, <span username>${
                    acc.username
                }</span>, has been removed. Thank you for using monofile.`
            ).catch()
            return ctx.text("OK")
        }

        await Accounts.deleteAccount(accountId)
        return ctx.text("account deleted")
    })

    router.put("/:user/password", requiresAccount, noAPIAccess, async (ctx) => {
        let acc = ctx.req.param("user") == "me" ? ctx.get("account") : Accounts.getFromId(ctx.req.param("user"))
        if (acc != ctx.get("account") && !ctx.get("account")?.admin) return ServeError(ctx, 403, "you are not an administrator")
        if (!acc) return ServeError(ctx, 404, "account does not exist")
        const body = await ctx.req.json()
        const newPassword = body.newPassword

        if (
            typeof body.password != "string" ||
            !Accounts.password.check(acc.id, body.password)
        ) {
            return ServeError(
                ctx,
                403,
                "previous password not supplied"
            )
        }

        if (
            typeof newPassword != "string" ||
            newPassword.length < 8
        ) {
            return ServeError(
                ctx,
                400,
                "password must be 8 characters or longer"
            )
        }

        Accounts.password.set(acc.id, newPassword)
        Accounts.save()

        if (acc.email) {
            await sendMail(
                acc.email,
                `Your login details have been updated`,
                `<b>Hello there!</b> Your password has been updated. Please update your saved login details accordingly.`
            ).catch()
            return ctx.text("OK")
        }
    })

    router.put("/:user/username", requiresAccount, noAPIAccess, async (ctx) => {
        let acc = ctx.req.param("user") == "me" ? ctx.get("account") : Accounts.getFromId(ctx.req.param("user"))
        if (acc != ctx.get("account") && !ctx.get("account")?.admin) return ServeError(ctx, 403, "you are not an administrator")
        if (!acc) return ServeError(ctx, 404, "account does not exist")
        const body = await ctx.req.json()
        const newUsername = body.username

        if (
            typeof newUsername != "string" ||
            newUsername.length < 3 ||
            newUsername.length > 20
        ) {
            return ServeError(
                ctx,
                400,
                "username must be between 3 and 20 characters in length"
            )
        }

        if (Accounts.getFromUsername(newUsername)) {
            return ServeError(
                ctx,
                400,
                "account with this username already exists"
            )
        }

        if (
            (newUsername.match(/[A-Za-z0-9_\-\.]+/) || [])[0] != body.username
        ) {
            ServeError(ctx, 400, "username contains invalid characters")
            return
        }

        acc.username = newUsername
        Accounts.save()

        if (acc.email) {
            await sendMail(
                acc.email,
                `Your login details have been updated`,
                `<b>Hello there!</b> Your username has been updated to <span username>${newUsername}</span>. Please update your saved login details accordingly.`
            ).catch()
            return ctx.text("OK")
        }
    })

    return router
}
