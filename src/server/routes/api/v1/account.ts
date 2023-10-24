// Modules


import { Hono } from "hono"
import { getCookie, setCookie } from "hono/cookie"

// Libs

import Files, { id_check_regex } from "../../../lib/files"
import * as Accounts from "../../../lib/accounts"
import * as Authentication from "../../../lib/auth"
import {
    assertAPI,
    getAccount,
    noAPIAccess,
    requiresAccount,
    requiresPermissions,
} from "../../../lib/middleware"
import ServeError from "../../../lib/errors"
import { sendMail } from "../../../lib/mail"

const Configuration = require(`${process.cwd()}/config.json`)

const router = new Hono<{
    Variables: {
        account: Accounts.Account
    }
}>()

router.use(getAccount)

module.exports = function (files: Files) {
    router.post("/login", async (ctx, res) => {
        const body = await ctx.req.json()
        if (
            typeof body.username != "string" ||
            typeof body.password != "string"
        ) {
            ServeError(ctx, 400, "please provide a username or password")
            return
        }

        if (Authentication.validate(getCookie(ctx, "auth")!)) {
            ServeError(ctx, 400, "you are already logged in")
            return
        }

        const Account = Accounts.getFromUsername(body.username)

        if (!Account || !Accounts.password.check(Account.id, body.password)) {
            ServeError(ctx, 400, "username or password incorrect")
            return
        }
        setCookie(
            ctx,
            "auth",
            Authentication.create(
                Account.id, // account id
                3 * 24 * 60 * 60 * 1000 // expiration time
            ),
            {
                // expires:
            }
        )
        ctx.status(200)
    })

    router.post("/create", async (ctx) => {
        const body = await ctx.req.json()
        if (!Configuration.accounts.registrationEnabled) {
            return ServeError(ctx, 403, "account registration disabled")
        }

        if (Authentication.validate(getCookie(ctx, "auth")!)) {
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
            .then((Account) => {
                setCookie(
                    ctx,
                    "auth",
                    Authentication.create(
                        Account, // account id
                        3 * 24 * 60 * 60 * 1000 // expiration time
                    ),
                    {
                        // expires:
                    }
                )
                return ctx.status(200)
            })
            .catch(() => {
                return ServeError(ctx, 500, "internal server error")
            })
    })

    router.post("/logout", (ctx) => {
        if (!Authentication.validate(getCookie(ctx, "auth")!)) {
            return ServeError(ctx, 401, "not logged in")
        }

        Authentication.invalidate(getCookie(ctx, "auth")!)
        return ctx.text("logged out")
    })

    router.patch(
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

    router.delete("/me", requiresAccount, noAPIAccess, async (ctx) => {
        const Account = ctx.get("account") as Accounts.Account
        const accountId = Account.id

        Authentication.AuthTokens.filter((e) => e.account == accountId).forEach(
            (token) => {
                Authentication.invalidate(token.token)
            }
        )

        await Accounts.deleteAccount(accountId)
        return ctx.text("account deleted")
    })

    router.patch("/me/name", requiresAccount, noAPIAccess, async (ctx) => {
        const Account = ctx.get("account") as Accounts.Account
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

        Account.username = newUsername
        Accounts.save()

        if (Account.email) {
            await sendMail(
                Account.email,
                `Your login details have been updated`,
                `<b>Hello there!</b> Your username has been updated to <span username>${newUsername}</span>. Please update your devices accordingly. Thank you for using monofile.`
            ).catch()
            return ctx.text("OK")
        }
    })

    return router
}
