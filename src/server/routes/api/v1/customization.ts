import { Hono } from "hono"
import Files, { id_check_regex } from "../../../lib/files"
import * as Accounts from "../../../lib/accounts"
import {
    getAccount,
    requiresAccount,
    requiresPermissions,
} from "../../../lib/middleware"
import ServeError from "../../../lib/errors"

const Configuration = require(`${process.cwd()}/config.json`)

const router = new Hono<{
    Variables: {
        account?: Accounts.Account
    }
}>()

router.use(getAccount)

module.exports = function (files: Files) {
    router.put(
        "/css",
        requiresAccount,
        requiresPermissions("customize"),
        async (ctx) => {
            const Account = ctx.get("account") as Accounts.Account
            const body = await ctx.req.json()
            if (typeof body.fileId != "string") body.fileId = undefined

            if (
                !body.fileId ||
                (body.fileId.match(id_check_regex) == body.fileId &&
                    body.fileId.length <= Configuration.maxUploadIdLength)
            ) {
                Account.customCSS = body.fileId || undefined

                await Accounts.save()
                return ctx.text("custom css saved")
            } else return ServeError(ctx, 400, "invalid fileId")
        }
    )

    router.get("/css", requiresAccount, async (ctx) => {
        const Account = ctx.get("account")

        if (Account?.customCSS)
            return ctx.redirect(`/file/${Account.customCSS}`)
        else return ctx.text("")
    })

    router.put(
        "/embed/color",
        requiresAccount,
        requiresPermissions("customize"),
        async (ctx) => {
            const Account = ctx.get("account") as Accounts.Account
            const body = await ctx.req.json()
            if (typeof body.color != "string") body.color = undefined

            if (
                !body.color ||
                (body.color.toLowerCase().match(/[a-f0-9]+/) ==
                    body.color.toLowerCase() &&
                    body.color.length == 6)
            ) {
                if (!Account.embed) Account.embed = {}
                Account.embed.color = body.color || undefined

                await Accounts.save()
                return ctx.text("custom embed color saved")
            } else return ServeError(ctx, 400, "invalid hex code")
        }
    )

    router.put(
        "/embed/size",
        requiresAccount,
        requiresPermissions("customize"),
        async (ctx) => {
            const Account = ctx.get("account") as Accounts.Account
            const body = await ctx.req.json()
            if (typeof body.largeImage != "boolean") {
                ServeError(ctx, 400, "largeImage must be bool")
                return
            }

            if (!Account.embed) Account.embed = {}
            Account.embed.largeImage = body.largeImage

            await Accounts.save()
            return ctx.text(`custom embed image size saved`)
        }
    )

    return router
}
