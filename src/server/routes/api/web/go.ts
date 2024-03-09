import fs from "fs/promises"
import bytes from "bytes"
import ServeError from "../../../lib/errors.js"
import * as Accounts from "../../../lib/accounts.js"
import type Files from "../../../lib/files.js"
import pkg from "../../../../../package.json" assert {type:"json"}
import { CodeMgr } from "../../../lib/mail.js"
import { Hono } from "hono"
import { getAccount, login } from "../../../lib/middleware.js"
export let router = new Hono<{
    Variables: {
        account: Accounts.Account
    }
}>()

export default function (files: Files) {
    router.get("/verify/:code", getAccount, async (ctx) => {
        let currentAccount = ctx.get("account")
        let code = CodeMgr.codes.verifyEmail.byId.get(ctx.req.param("code"))

        if (code) {
            if (currentAccount != undefined && !code.check(currentAccount.id)) {
                return ServeError(ctx, 403, "you are logged in on a different account")
            }

            if (!currentAccount) {
                login(ctx, code.for)
                let ac = Accounts.getFromId(code.for)
                if (ac) currentAccount = ac
                else return ServeError(ctx, 401, "could not locate account")
            }

            currentAccount.email = code.data
            await Accounts.save()
            
            return ctx.redirect('/')
        } else return ServeError(ctx, 404, "code not found")
    })

    return router
}