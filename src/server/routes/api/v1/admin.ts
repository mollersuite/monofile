// Modules

import { writeFile } from 'fs'
import { Router } from "express";
import bodyParser from "body-parser";

// Libs

import Files, { id_check_regex } from "../../../lib/files";
import * as Accounts from '../../../lib/accounts'
import * as Authentication from '../../../lib/auth'
import { assertAPI, getAccount, noAPIAccess, requiresAccount, requiresAdmin, requiresPermissions } from "../../../lib/middleware";
import ServeError from "../../../lib/errors";
import { sendMail } from '../../../lib/mail';

const Configuration = require(`${process.cwd()}/config.json`)

const parser = bodyParser.json({
    type: [ "type/plain", "application/json" ]
})

const router = Router()

router.use(getAccount, requiresAccount, requiresAdmin, parser)

module.exports = function(files: Files) {
    router.patch(
        "/account/:username/password",
        (req, res) => {
            const Account = res.locals.acc

            const targetUsername = req.params.username
            const password = req.body.password

            if (typeof password !== "string") {
                ServeError(res, 404, "")
                return
            }

            const targetAccount = Accounts.getFromUsername(targetUsername)

            if (!targetAccount) {
                ServeError(res, 404, "")
                return
            }

            Accounts.password.set( targetAccount.id, password )
            
            Authentication.AuthTokens.filter(e => e.account == targetAccount?.id).forEach((accountToken) => {
                Authentication.invalidate(accountToken.token)
            })

            if (targetAccount.email) {
                sendMail(targetAccount.email, `Your login details have been updated`, `<b>Hello there!</b> This email is to notify you of a password change that an administrator, <span username>${Account.username}</span>, has initiated. You have been logged out of your devices. Thank you for using monofile.`).then(() => {
                    res.send("OK")
                }).catch((err) => {})
            }

            res.send()
        }
    )

    router.patch(
        "/account/:username/elevate",
        (req, res) => {
            const targetUsername = req.params.username
            const targetAccount = Accounts.getFromUsername(targetUsername)

            if (!targetAccount) {
                ServeError(res, 404, "")
                return
            }

            targetAccount.admin = true
            Accounts.save()

            res.send()
        }
    )

    

    return router
}