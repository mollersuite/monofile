// Modules

import { Router } from "express";
import bodyParser from "body-parser";

// Libs

import Files, { id_check_regex } from "../../../lib/files";
import * as Accounts from '../../../lib/accounts'
import { getAccount, requiresAccount, requiresPermissions } from "../../../lib/middleware";

const Configuration = require(`${process.cwd()}/config.json`)

const parser = bodyParser.json({
    type: [ "type/plain", "application/json" ]
})

const router = Router()

router.use(getAccount)

module.exports = function(files: Files) {
    router.put("/css",
        requiresAccount,
        requiresPermissions("customize"),
        parser,
        (req, res) => {
            const Account = res.locals.acc as Accounts.Account

            if (typeof req.body.fileId != "string") req.body.fileId = undefined;

            if (
                !req.body.fileId
                ||
                (req.body.fileId.match(id_check_regex) == req.body.fileId 
                && req.body.fileId.length <= Configuration.maxUploadIdLength)
            ) {
                Account.customCSS = req.body.fileId || undefined

                if (!req.body.fileId) delete Account.customCSS;

                Accounts.save()

                res.send("custom css saved")
            } else {
                res.status(400)

                res.send("invalid fileid")
            }
        }
    )

    router.get('/css',
        requiresAccount,
        (req, res) => {
            const Account = res.locals.acc

            if (Account?.customCSS) res.redirect(`/file/${Account.customCSS}`)
            else res.send("");
        }
    )

    router.put("/embed/color",
        requiresAccount,
        requiresPermissions("customize"),
        parser,
        (req, res) => {
            const Account = res.locals.acc as Accounts.Account

            if (typeof req.body.color != "string") req.body.color = undefined;
            
            if (
                !req.body.color
                || (req.body.color.toLowerCase().match(/[a-f0-9]+/) == req.body.color.toLowerCase())
                && req.body.color.length == 6
            ) {
                if (!Account.embed) Account.embed = {};

                Account.embed.color = req.body.color || undefined

                if (!req.body.color) delete Account.embed.color;

                Accounts.save()

                res.send("custom embed color saved")
            } else {
                res.status(400)

                res.send("invalid hex code")
            }
        }
    )

    router.put("/embed/size",
        requiresAccount,
        requiresPermissions("customize"),
        parser,
        (req, res) => {
            const Account = res.locals.acc as Accounts.Account

            if (typeof req.body.largeImage != "boolean") req.body.color = false;

            if (!Account.embed) Account.embed = {};

            Account.embed.largeImage = req.body.largeImage
            
            if (!req.body.largeImage) delete Account.embed.largeImage;

            Accounts.save()

            res.send(`custom embed image size saved`)
        }
    )

    return router
}