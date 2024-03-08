import { Hono, Handler } from "hono"
import { getCookie, setCookie } from "hono/cookie"
import * as Accounts from "../../../lib/accounts.js"
import * as auth from "../../../lib/auth.js"
import { sendMail } from "../../../lib/mail.js"
import {
    getAccount,
    noAPIAccess,
    requiresAccount,
    requiresPermissions,
} from "../../../lib/middleware.js"
import { accountRatelimit } from "../../../lib/ratelimit.js"

import ServeError from "../../../lib/errors.js"
import Files, {
    FileVisibility,
    generateFileId,
    id_check_regex,
} from "../../../lib/files.js"

import { writeFile } from "fs/promises"

export let authRoutes = new Hono<{
    Variables: {
        account: Accounts.Account
    }
}>()

import config from "../../../../../config.json" assert {type:"json"}
authRoutes.all("*", getAccount)

export default function (files: Files) {
    authRoutes.post("/login", async (ctx) => {
        const body = await ctx.req.json()
        if (
            typeof body.username != "string" ||
            typeof body.password != "string"
        ) {
            return ServeError(ctx, 400, "please provide a username or password")
        }

        if (auth.validate(getCookie(ctx, "auth")!))
            return ctx.text("You are already authed")

        /*
            check if account exists  
        */

        let acc = Accounts.getFromUsername(body.username)

        if (!acc) {
            return ServeError(ctx, 401, "username or password incorrect")
        }

        if (!Accounts.password.check(acc.id, body.password)) {
            return ServeError(ctx, 401, "username or password incorrect")
        }

        /*
            assign token
        */

        setCookie(ctx, "auth", auth.create(acc.id, 3 * 24 * 60 * 60 * 1000), {
            path: "/",
            sameSite: "Strict",
            secure: true,
            httpOnly: true,
            maxAge: 3 * 24 * 60 * 60 * 1000,
        })
        return ctx.text("")
    })

    authRoutes.post("/create", async (ctx) => {
        if (!config.accounts.registrationEnabled) {
            return ServeError(ctx, 403, "account registration disabled")
        }

        if (auth.validate(getCookie(ctx, "auth")!)) return
        const body = await ctx.req.json()
        if (
            typeof body.username != "string" ||
            typeof body.password != "string"
        ) {
            return ServeError(ctx, 400, "please provide a username or password")
        }

        /*
            check if account exists  
        */

        let acc = Accounts.getFromUsername(body.username)

        if (acc) {
            ServeError(ctx, 400, "account with this username already exists")
            return
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
            ServeError(ctx, 400, "password must be 8 characters or longer")
            return
        }

        return Accounts.create(body.username, body.password)
            .then((newAcc) => {
                /*
                    assign token
                */

                setCookie(
                    ctx,
                    "auth",
                    auth.create(newAcc, 3 * 24 * 60 * 60 * 1000)
                )
                return ctx.text("")
            })
            .catch(() => ServeError(ctx, 500, "internal server error"))
    })

    authRoutes.post("/logout", async (ctx) => {
        if (!auth.validate(getCookie(ctx, "auth")!)) {
            return ServeError(ctx, 401, "not logged in")
        }

        auth.invalidate(getCookie(ctx, "auth")!)
        return ctx.text("logged out")
    })

    authRoutes.post(
        "/dfv",
        requiresAccount,
        requiresPermissions("manage"),
        // Used body-parser
        async (ctx) => {
            const body = await ctx.req.json()
            let acc = ctx.get("account") as Accounts.Account

            if (
                ["public", "private", "anonymous"].includes(
                    body.defaultFileVisibility
                )
            ) {
                acc.defaultFileVisibility = body.defaultFileVisibility
                Accounts.save()
                return ctx.text(
                    `dfv has been set to ${acc.defaultFileVisibility}`
                )
            } else {
                return ctx.text("invalid dfv", 400)
            }
        }
    )

    authRoutes.post(
        "/delete_account",
        requiresAccount,
        noAPIAccess,
        // Used body-parser
        async (ctx) => {
            let acc = ctx.get("account") as Accounts.Account
            const body = await ctx.req.json()
            let accId = acc.id

            auth.AuthTokens.filter((e) => e.account == accId).forEach((v) => {
                auth.invalidate(v.token)
            })

            let cpl = () =>
                Accounts.deleteAccount(accId).then((_) =>
                    ctx.text("account deleted")
                )

            if (body.deleteFiles) {
                let f = acc.files.map((e) => e) // make shallow copy so that iterating over it doesnt Die
                for (let v of f) {
                    files.unlink(v, true).catch((err) => console.error(err))
                }

                return writeFile(
                    process.cwd() + "/.data/files.json",
                    JSON.stringify(files.files)
                ).then(cpl)
            } else cpl()
        }
    )

    authRoutes.post(
        "/change_username",
        requiresAccount,
        noAPIAccess,
        // Used body-parser
        async (ctx) => {
            let acc = ctx.get("account") as Accounts.Account
            const body = await ctx.req.json()
            if (
                typeof body.username != "string" ||
                body.username.length < 3 ||
                body.username.length > 20
            ) {
                return ServeError(
                    ctx,
                    400,
                    "username must be between 3 and 20 characters in length"
                )
            }

            let _acc = Accounts.getFromUsername(body.username)

            if (_acc) {
                return ServeError(
                    ctx,
                    400,
                    "account with this username already exists"
                )
            }

            if (
                (body.username.match(/[A-Za-z0-9_\-\.]+/) || [])[0] !=
                body.username
            ) {
                return ServeError(
                    ctx,
                    400,
                    "username contains invalid characters"
                )
            }

            acc.username = body.username
            Accounts.save()

            if (acc.email) {
                return sendMail(
                    acc.email,
                    `Your login details have been updated`,
                    `<b>Hello there!</b> Your username has been updated to <span username>${body.username}</span>. Please update your devices accordingly. Thank you for using monofile.`
                )
                    .then(() => ctx.text("OK"))
                    .catch((err) => {})
            }

            return ctx.text("username changed")
        }
    )

    // shit way to do this but...

    let verificationCodes = new Map<
        string,
        { code: string; email: string; expiry: NodeJS.Timeout }
    >()

    authRoutes.post(
        "/request_email_change",
        requiresAccount,
        noAPIAccess,
        accountRatelimit({ requests: 4, per: 60 * 60 * 1000 }),
        // Used body-parser
        async (ctx) => {
            let acc = ctx.get("account") as Accounts.Account
            const body = await ctx.req.json()
            if (typeof body.email != "string" || !body.email) {
                ServeError(ctx, 400, "supply an email")
                return
            }

            let vcode = verificationCodes.get(acc.id)

            // delete previous if any
            let e = vcode?.expiry
            if (e) clearTimeout(e)
            verificationCodes.delete(acc?.id || "")

            let code = generateFileId(12).toUpperCase()

            // set

            verificationCodes.set(acc.id, {
                code,
                email: body.email,
                expiry: setTimeout(
                    () => verificationCodes.delete(acc?.id || ""),
                    15 * 60 * 1000
                ),
            })

            // this is a mess but it's fine

            sendMail(
                body.email,
                `Hey there, ${acc.username} - let's connect your email`,
                `<b>Hello there!</b> You are recieving this message because you decided to link your email, <span code>${
                    body.email.split("@")[0]
                }<span style="opacity:0.5">@${
                    body.email.split("@")[1]
                }</span></span>, to your account, <span username>${
                    acc.username
                }</span>. If you would like to continue, please <a href="https://${ctx.req.header(
                    "Host"
                )}/auth/confirm_email/${code}"><span code>click here</span></a>, or go to https://${ctx.req.header(
                    "Host"
                )}/auth/confirm_email/${code}.`
            )
                .then(() => ctx.text("OK"))
                .catch((err) => {
                    let e = verificationCodes.get(acc?.id || "")?.expiry
                    if (e) clearTimeout(e)
                    verificationCodes.delete(acc?.id || "")
                    ;(ctx.get("undoCount" as never) as () => {})()
                    return ServeError(ctx, 500, err?.toString())
                })
        }
    )

    authRoutes.get(
        "/confirm_email/:code",
        requiresAccount,
        noAPIAccess,
        async (ctx) => {
            let acc = ctx.get("account") as Accounts.Account

            let vcode = verificationCodes.get(acc.id)

            if (!vcode) {
                ServeError(ctx, 400, "nothing to confirm")
                return
            }

            if (
                typeof ctx.req.param("code") == "string" &&
                ctx.req.param("code").toUpperCase() == vcode.code
            ) {
                acc.email = vcode.email
                Accounts.save()

                let e = verificationCodes.get(acc?.id || "")?.expiry
                if (e) clearTimeout(e)
                verificationCodes.delete(acc?.id || "")

                return ctx.redirect("/")
            } else {
                return ServeError(ctx, 400, "invalid code")
            }
        }
    )

    authRoutes.post(
        "/remove_email",
        requiresAccount,
        noAPIAccess,
        async (ctx) => {
            let acc = ctx.get("account") as Accounts.Account

            if (acc.email) {
                delete acc.email
                Accounts.save()
                return ctx.text("email detached")
            } else return ServeError(ctx, 400, "email not attached")
        }
    )

    let pwReset = new Map<
        string,
        { code: string; expiry: NodeJS.Timeout; requestedAt: number }
    >()
    let prcIdx = new Map<string, string>()

    authRoutes.post("/request_emergency_login", async (ctx) => {
        if (auth.validate(getCookie(ctx, "auth") || "")) return
        const body = await ctx.req.json()
        if (typeof body.account != "string" || !body.account) {
            ServeError(ctx, 400, "supply a username")
            return
        }

        let acc = Accounts.getFromUsername(body.account)
        if (!acc || !acc.email) {
            return ServeError(
                ctx,
                400,
                "this account either does not exist or does not have an email attached; please contact the server's admin for a reset if you would still like to access it"
            )
        }

        let pResetCode = pwReset.get(acc.id)

        if (
            pResetCode &&
            pResetCode.requestedAt + 15 * 60 * 1000 > Date.now()
        ) {
            return ServeError(
                ctx,
                429,
                `Please wait a few moments to request another emergency login.`
            )
        }

        // delete previous if any
        let e = pResetCode?.expiry
        if (e) clearTimeout(e)
        pwReset.delete(acc?.id || "")
        prcIdx.delete(pResetCode?.code || "")

        let code = generateFileId(12).toUpperCase()

        // set

        pwReset.set(acc.id, {
            code,
            expiry: setTimeout(() => {
                pwReset.delete(acc?.id || "")
                prcIdx.delete(pResetCode?.code || "")
            }, 15 * 60 * 1000),
            requestedAt: Date.now(),
        })

        prcIdx.set(code, acc.id)

        // this is a mess but it's fine

        return sendMail(
            acc.email,
            `Emergency login requested for ${acc.username}`,
            `<b>Hello there!</b> You are recieving this message because you forgot your password to your monofile account, <span username>${
                acc.username
            }</span>. To log in, please <a href="https://${ctx.req.header(
                "Host"
            )}/auth/emergency_login/${code}"><span code>click here</span></a>, or go to https://${ctx.req.header(
                "Host"
            )}/auth/emergency_login/${code}. If it doesn't appear that you are logged in after visiting this link, please try refreshing. Once you have successfully logged in, you may reset your password.`
        )
            .then(() => ctx.text("OK"))
            .catch((err) => {
                let e = pwReset.get(acc?.id || "")?.expiry
                if (e) clearTimeout(e)
                pwReset.delete(acc?.id || "")
                prcIdx.delete(code || "")
                return ServeError(ctx, 500, err?.toString())
            })
    })

    authRoutes.get("/emergency_login/:code", async (ctx) => {
        if (auth.validate(getCookie(ctx, "auth") || "")) {
            return ServeError(ctx, 403, "already logged in")
        }

        let vcode = prcIdx.get(ctx.req.param("code"))

        if (!vcode) {
            return ServeError(ctx, 400, "invalid emergency login code")
        }

        if (typeof ctx.req.param("code") == "string" && vcode) {
            setCookie(ctx, "auth", auth.create(vcode, 3 * 24 * 60 * 60 * 1000))
            let e = pwReset.get(vcode)?.expiry
            if (e) clearTimeout(e)
            pwReset.delete(vcode)
            prcIdx.delete(ctx.req.param("code"))
            return ctx.redirect("/")
        } else {
            ServeError(ctx, 400, "invalid code")
        }
    })

    authRoutes.post(
        "/change_password",
        requiresAccount,
        noAPIAccess,
        // Used body-parser
        async (ctx) => {
            let acc = ctx.get("account") as Accounts.Account
            const body = await ctx.req.json()
            if (typeof body.password != "string" || body.password.length < 8) {
                ServeError(ctx, 400, "password must be 8 characters or longer")
                return
            }

            let accId = acc.id

            Accounts.password.set(accId, body.password)

            auth.AuthTokens.filter((e) => e.account == accId).forEach((v) => {
                auth.invalidate(v.token)
            })

            if (acc.email) {
                return sendMail(
                    acc.email,
                    `Your login details have been updated`,
                    `<b>Hello there!</b> This email is to notify you of a password change that you have initiated. You have been logged out of your devices. Thank you for using monofile.`
                )
                    .then(() => ctx.text("OK"))
                    .catch((err) => {})
            }

            return ctx.text("password changed - logged out all sessions")
        }
    )

    authRoutes.post(
        "/logout_sessions",
        requiresAccount,
        noAPIAccess,
        async (ctx) => {
            let acc = ctx.get("account") as Accounts.Account

            let accId = acc.id

            auth.AuthTokens.filter((e) => e.account == accId).forEach((v) => {
                auth.invalidate(v.token)
            })

            return ctx.text("logged out all sessions")
        }
    )

    authRoutes.get(
        "/me",
        requiresAccount,
        requiresPermissions("user"),
        async (ctx) => {
            let acc = ctx.get("account") as Accounts.Account
            let sessionToken = auth.tokenFor(ctx)!
            let accId = acc.id
            return ctx.json({
                ...acc,
                sessionCount: auth.AuthTokens.filter(
                    (e) =>
                        e.type != "App" &&
                        e.account == accId &&
                        (e.expire > Date.now() || !e.expire)
                ).length,
                sessionExpires: auth.AuthTokens.find(
                    (e) => e.token == sessionToken
                )?.expire,
                password: undefined,
                email:
                    auth.getType(sessionToken) == "User" ||
                    auth.getPermissions(sessionToken)?.includes("email")
                        ? acc.email
                        : undefined,
            })
        }
    )

    return authRoutes
}
