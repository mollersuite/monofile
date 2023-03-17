import bodyParser from "body-parser";
import { Router } from "express";
import * as Accounts from "../lib/accounts";
import * as auth from "../lib/auth";
import bytes from "bytes"

import ServeError from "../lib/errors";
import Files from "../lib/files";

let parser = bodyParser.json({
    type: ["text/plain","application/json"]
})

export let fileApiRoutes = Router();
let files:Files

export function setFilesObj(newFiles:Files) {
    files = newFiles
}

let config = require(`${process.cwd()}/config.json`)

fileApiRoutes.get("/list", (req,res) => {

    if (!auth.validate(req.cookies.auth)) {
        ServeError(res, 401, "not logged in")
        return
    }

    let acc = Accounts.getFromToken(req.cookies.auth)
    
    if (!acc) return

    res.send(acc.files.map((e) => {
        let fp = files.getFilePointer(e)
        return {
            ...fp,
            messageids: null,
            owner: null,
            id:e,
            sizeDisplay: fp.sizeInBytes ? bytes(fp.sizeInBytes) : "[File size unknown]"
        }
    }))

})

fileApiRoutes.post("/action", (req,res) => {

    if (!auth.validate(req.cookies.auth)) {
        ServeError(res, 401, "not logged in")
        return
    }

    let acc = Accounts.getFromToken(req.cookies.auth)
    
    if (!acc) return

})