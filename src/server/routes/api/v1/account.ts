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
        account: Accounts.Account,
        target: Accounts.Account
    }
}>()

type UserUpdateParameters = Partial<Omit<Accounts.Account, "password"> & { password: string, currentPassword?: string }>
type Message = [200 | 400 | 401 | 403 | 501, string]

// there's probably a less stupid way to do this than `K in keyof Pick<UserUpdateParameters, T>`
// @Jack5079 make typings better if possible
const validators: {
    [T in keyof Partial<Accounts.Account>]: 
        /**
         * @param actor The account performing this action
         * @param target The target account for this action
         * @param params Changes being patched in by the user
         */
        (actor: Accounts.Account, target: Accounts.Account, params: UserUpdateParameters & {
            [K in keyof Pick<UserUpdateParameters, T>]-? : UserUpdateParameters[K]
        }) => Accounts.Account[T] | Message
} = {
    defaultFileVisibility(actor, target, params) {
        if (["public", "private", "anonymous"].includes(params.defaultFileVisibility)) 
            return params.defaultFileVisibility
        else return [400, "invalid file visibility"]
    },
    email(actor, target, params) {
        return [501, "not implemented"]
    },
    password(actor, target, params) {
        if (
            !params.currentPassword
            || (params.currentPassword && Accounts.password.check(actor.id, params.currentPassword))
        ) return [401, "current password incorrect"]

        if (
            typeof params.password != "string"
            || params.password.length < 8
        ) return [400, "password must be 8 characters or longer"]

        if (target.email) {
            sendMail(
                target.email,
                `Your login details have been updated`,
                `<b>Hello there!</b> Your password on your account, <span username>${target.username}</span>, has been updated`
                + `${actor != target ? ` by <span username>${actor.username}</span>` : ""}. `
                + `Please update your saved login details accordingly.`
            ).catch()
        }

        return Accounts.password.hash(params.password)

    },
    username(actor, target, params) {
        if (!params.currentPassword
            || (params.currentPassword && Accounts.password.check(actor.id, params.currentPassword))) 
            return [401, "current password incorrect"]

        if (
            typeof params.username != "string"
            || params.username.length < 3
            || params.username.length > 20
        ) return [400, "username must be between 3 and 20 characters in length"]

        if (Accounts.getFromUsername(params.username))
            return [400, "account with this username already exists"]

        if ((params.username.match(/[A-Za-z0-9_\-\.]+/) || [])[0] != params.username)
            return [400, "username has invalid characters"]

        if (target.email) {
            sendMail(
                target.email,
                `Your login details have been updated`,
                `<b>Hello there!</b> Your username on your account, <span username>${target.username}</span>, has been updated`
                + `${actor != target ? ` by <span username>${actor.username}</span>` : ""} to <span username>${params.username}</span>. `
                + `Please update your saved login details accordingly.`
            ).catch()
        }

        return params.username

    },
    customCSS(actor, target, params) {
        if (
            !params.customCSS ||
            (params.customCSS.match(id_check_regex)?.[0] == params.customCSS &&
                params.customCSS.length <= Configuration.maxUploadIdLength)
        ) return params.customCSS
        else return [400, "bad file id"]
    },
    admin(actor, target, params) {
        if (actor.admin && !target.admin) return params.admin
        else if (!actor.admin) return [400, "cannot promote yourself"]
        else return [400, "cannot demote an admin"]
    }
}

router.use(getAccount)
router.all("/:user", async (ctx, next) => {
    let acc = 
        ctx.req.param("user") == "me" 
        ? ctx.get("account") 
        : (
            ctx.req.param("user").startsWith("@")
            ? Accounts.getFromUsername(ctx.req.param("user").slice(1))
            : Accounts.getFromId(ctx.req.param("user"))
        )
    if (
        acc != ctx.get("account") 
        && !ctx.get("account")?.admin
    ) return ServeError(ctx, 403, "you cannot manage this user")
    if (!acc) return ServeError(ctx, 404, "account does not exist")

    ctx.set("target", acc)

    return next()
})

function isMessage(object: any): object is Message {
    return Array.isArray(object) 
        && object.length == 2
        && typeof object[0] == "number"
        && typeof object[1] == "string"
}

export default function (files: Files) {

    router.post("/", async (ctx) => {
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

    router.patch(
        "/:user",
        requiresAccount,
        requiresPermissions("manage"),
        async (ctx) => {
            const body = await ctx.req.json() as UserUpdateParameters
            const actor = ctx.get("account")!
            const target = ctx.get("target")!
            if (Array.isArray(body))
                return ServeError(ctx, 400, "invalid body")

            let results: [keyof Accounts.Account, Accounts.Account[keyof Accounts.Account]|Message][] = Object.entries(body).filter(e => e[1] && e[0] !== "currentPassword").map(([x]) =>
                [
                    x as keyof Accounts.Account, 
                    x in validators
                    ? validators[x as keyof Accounts.Account]!(actor, target, body as any)
                    : [400, `the ${x} parameter cannot be set or is not a valid parameter`] as Message
                ]
            )

            let allMsgs = results.map(([x,v]) => {
                if (isMessage(v))
                    return v
                target[x] = v as never // lol
                return [200, "OK"] as Message
            })

            if (allMsgs.length == 1)
                return ctx.body(...allMsgs[0]!.reverse() as [Message[1], Message[0]]) // im sorry
            else return ctx.json(allMsgs)
        }
    )

    router.delete("/:user", requiresAccount, noAPIAccess, async (ctx) => {
        let acc = ctx.get("target")

        auth.AuthTokens.filter((e) => e.account == acc?.id).forEach(
            (token) => {
                auth.invalidate(token.token)
            }
        )

        await Accounts.deleteAccount(acc.id)

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
        
        return ctx.text("account deleted")
    })

    router.get("/:user")

    return router
}
