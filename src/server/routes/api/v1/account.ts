// Modules

import { Router } from "express";
import bodyParser from "body-parser";

// Libs

import Files, { id_check_regex } from "../../../lib/files";
import * as Accounts from '../../../lib/accounts'
import * as Authentication from '../../../lib/auth'
import { assertAPI, getAccount, noAPIAccess, requiresAccount, requiresPermissions } from "../../../lib/middleware";
import ServeError from "../../../lib/errors";

const Configuration = require(`${process.cwd()}/config.json`)

const parser = bodyParser.json({
    type: [ "type/plain", "application/json" ]
})

const router = Router()

router.use(getAccount)

module.exports = function(files: Files) {
    router.post("/login",
        parser,
        (req, res) => {
            if (typeof req.body.username != "string" || typeof req.body.password != "string") {
                ServeError(res, 400, "please provide a username or password")
                return
            }

            if (Authentication.validate(req.cookies.auth)) {
                ServeError(res, 400, "you are already logged in")
                return
            }

            const Account = Accounts.getFromUsername(req.body.username)

            if (!Account || !Accounts.password.check(Account.id, req.body.password)) {
                ServeError(res, 400, "username or password incorrect")
                return
            }

            res.cookie("auth",
                Authentication.create(
                    Account.id, // account id
                    (3 * 24 * 60 * 60 * 1000) // expiration time
                )
            )
            res.status(200)
            res.end()
        }
    )

    router.post("/create",
        parser,
        (req, res) => {
            if (!Configuration.accounts.registrationEnabled) {
                ServeError(res , 403, "account registration disabled")
                return
            }

            if (Authentication.validate(req.cookies.auth)) {
                ServeError(res, 400, "you are already logged in")
                return
            }

            if (Accounts.getFromUsername(req.body.username)) {
                ServeError(res, 400, "account with this username already exists")
                return
            }

            if (req.body.username.length < 3 || req.body.username.length > 20) {
                ServeError(res, 400, "username must be over or equal to 3 characters or under or equal to 20 characters in length")
                return
            }

            if (
                (
                    req.body.username.match(/[A-Za-z0-9_\-\.]+/)
                    ||
                    []
                )[0] != req.body.username
            ) {
                ServeError(res, 400, "username contains invalid characters")
                return
            }

            if (req.body.password.length < 8) {
                ServeError(res, 400, "password must be 8 characters or longer")
                return
            }

            Accounts.create(
                req.body.username,
                req.body.password
            ).then((Account) => {
                res.cookie("auth", Authentication.create(
                    Account, // account id
                    (3 * 24 * 60 * 60 * 1000) // expiration time
                ))
                res.status(200)
                res.end()
            })
            .catch(() => {
                ServeError(res, 500, "internal server error")
            })
        }
    )

    router.post("/logout",
        (req, res) => {
            if (!Authentication.validate(req.cookies.auth)) {
                ServeError(res, 401, "not logged in")
                return
            }

            Authentication.invalidate(req.cookies.auth)
            res.send("logged out")
        }
    )

    router.put("/dfv",
        requiresAccount,
        requiresPermissions("manage"),
        parser,
        (req, res) => {
            const Account = res.locals.acc as Accounts.Account

            if (['public', 'private', 'anonymous'].includes(req.body.defaultFileVisibility)) {
                Account.defaultFileVisibility = req.body.defaultFileVisibility
                
                Accounts.save()
                
                res.send(`dfv has been set to ${Account.defaultFileVisibility}`)
            } else {
                res.status(400)
                
                res.send("invalid dfv")
            }
        }
    )

    return router
}