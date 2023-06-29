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
    if (typeof req.body.target !== "string" || typeof req.body.password !== "string") {
        res.status(404)
        res.send()
        return
    }

    let targetAccount = Accounts.getFromUsername(req.body.target)
    if (!targetAccount) {
        res.status(404)
        res.send()
        return
    }

    Accounts.password.set ( targetAccount.id, req.body.password )
    res.send()

})

adminRoutes.post("/transfer", parser, (req,res) => {

    if (!auth.validate(req.cookies.auth)) {
        ServeError(res, 401, "not logged in")
        return
    }

    let acc = Accounts.getFromToken(req.cookies.auth) as Accounts.Account
    
    if (!acc) return
    if (!acc.admin) return
    if (typeof req.body.target !== "string" || typeof req.body.owner !== "string") {
        res.status(404)
        res.send()
        return
    }
    
    let targetFile = files.getFilePointer(req.body.target)
    if (!targetFile) {
        res.status(404)
        res.send()
        return
    }

    let newOwner = Accounts.getFromUsername(req.body.owner || "")

    // clear old owner

    if (targetFile.owner) {
        let oldOwner = Accounts.getFromId(targetFile.owner)
        if (oldOwner) {
            Accounts.files.deindex(oldOwner.id, req.body.target)
        } 
    }

    if (newOwner) {
        Accounts.files.index(newOwner.id, req.body.target)
    }
    targetFile.owner = newOwner ? newOwner.id : undefined;

    files.writeFile(req.body.target, targetFile).then(() => {
        res.send()
    }).catch(() => {
        res.status(500)
        res.send()
    }) // wasting a reassignment but whatee

})