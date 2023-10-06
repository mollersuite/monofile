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
            const Account = res.locals.acc as Accounts.Account

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

    router.delete("/account/:username/:deleteFiles",
        requiresAccount,
        noAPIAccess,
        parser,
        (req, res) => {
            const targetUsername = req.params.username
            const deleteFiles = req.params.deleteFiles

            const targetAccount = Accounts.getFromUsername(targetUsername)

            if (!targetAccount) {
                ServeError(res, 404, "")
                return
            }

            const accountId = targetAccount.id

            Authentication.AuthTokens.filter(e => e.account == accountId).forEach((token) => {
                Authentication.invalidate(token.token)
            })

            const deleteAccount = () => Accounts.deleteAccount(accountId).then(_ => res.send("account deleted"))

            if (Boolean(deleteFiles)) {
                const Files = targetAccount.files.map(e => e)

                for (let fileId of Files) {
                    files.unlink(fileId, true).catch(err => console.error)
                }

                writeFile(process.cwd() + "/.data/files.json", JSON.stringify(files.files), (err) => {
                    if (err) console.log(err)
                    deleteAccount()
                })
            } else deleteAccount()
        }
    )

    return router
}