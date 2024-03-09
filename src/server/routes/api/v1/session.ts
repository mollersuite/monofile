// Modules


import { Hono } from "hono"
import { getCookie, setCookie } from "hono/cookie"

// Libs

import Files, { id_check_regex } from "../../../lib/files.js"
import * as Accounts from "../../../lib/accounts.js"
import * as auth from "../../../lib/auth.js"
import {
    getAccount,
    login,
    requiresAccount
} from "../../../lib/middleware.js"
import ServeError from "../../../lib/errors.js"

const router = new Hono<{
    Variables: {
        account: Accounts.Account
    }
}>()

router.use(getAccount)

export default function (files: Files) {
    router.post("/", async (ctx, res) => {
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

        login(ctx, account.id)
        return ctx.text("logged in")
    })

    router.get("/", requiresAccount, ctx => {
        let sessionToken = auth.tokenFor(ctx)
        return ctx.json({
            expiry: auth.AuthTokens.find(
                (e) => e.token == sessionToken
            )?.expire,
        })
    })

    router.delete("/", (ctx) => {
        if (!auth.validate(getCookie(ctx, "auth")!)) {
            return ServeError(ctx, 401, "not logged in")
        }

        auth.invalidate(getCookie(ctx, "auth")!)
        return ctx.text("logged out")
    })

    return router
}
