import bodyParser from "body-parser";
import { Router } from "express";
import * as Accounts from "../lib/accounts";
import * as auth from "../lib/auth";
import bytes from "bytes"
import {writeFile} from "fs";

import ServeError from "../lib/errors";
import Files from "../lib/files";

let parser = bodyParser.json({
    type: ["text/plain","application/json"]
})

export let adminRoutes = Router();
let files:Files

export function admin_setFilesObj(newFiles:Files) {
    files = newFiles
}

let config = require(`${process.cwd()}/config.json`)

adminRoutes.post("/manage", parser, (req,res) => {

    if (!auth.validate(req.cookies.auth)) {
        ServeError(res, 401, "not logged in")
        return
    }

    let acc = Accounts.getFromToken(req.cookies.auth) as Accounts.Account
    
    if (!acc) return
    if (!acc.admin) return

})

adminRoutes.post("/reset", parser, (req,res) => {

    if (!auth.validate(req.cookies.auth)) {
        ServeError(res, 401, "not logged in")
        return
    }

    let acc = Accounts.getFromToken(req.cookies.auth) as Accounts.Account
    
    if (!acc) return
    if (!acc.admin) return
    if (typeof req.body.target !== "string" || typeof req.body.password !== "string" || !req.body.password) {
        res.status(404)
        return
    }

    let targetAccount = Accounts.getFromUsername(req.body.target)
    if (!targetAccount) {
        res.status(404)
        return
    }

    Accounts.password.set ( targetAccount.id, req.body.password )

})