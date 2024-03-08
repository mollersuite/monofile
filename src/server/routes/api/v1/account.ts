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

type UserUpdateParameters = Partial<Accounts.Account & { password: string, newPassword?: string }>
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
            let body = await ctx.req.json() as UserUpdateParameters
            
        }
    )

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

    router.delete("/:user", requiresAccount, noAPIAccess, async (ctx) => {
        let acc = ctx.req.param("user") == "me" ? ctx.get("account") : Accounts.getFromId(ctx.req.param("user"))
        if (acc != ctx.get("account") && !ctx.get("account")?.admin) return ServeError(ctx, 403, "you are not an administrator")
        if (!acc) return ServeError(ctx, 404, "account does not exist")

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
