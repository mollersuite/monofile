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

fileApiRoutes.post("/manage", parser, (req,res) => {

    if (!auth.validate(req.cookies.auth)) {
        ServeError(res, 401, "not logged in")
        return
    }

    let acc = Accounts.getFromToken(req.cookies.auth) as Accounts.Account
    
    if (!acc) return
    if (!req.body.target || !(typeof req.body.target == "object") || req.body.target.length < 1) return

    let modified = 0
    
    req.body.target.forEach((e:string) => {
        if (!acc.files.includes(e)) return

        let fp = files.getFilePointer(e)

        if (fp.reserved) {
            if (req.body.target.length == 1) {
                ServeError(res, 400, `cannot modify a file that is being uploaded, please contact an administrator if your file is stuck in this state.`)
            }
            return
        }

        switch( req.body.action ) {
            case "delete":
                files.unlink(e)
                modified++;
            break;

            case "changeFileVisibility":
                if (!["public","anonymous","private"].includes(req.body.value)) return;
                files.files[e].visibility = req.body.value;
                modified++;
            break;

            case "setTag":
                if (!req.body.value) delete files.files[e].tag
                else {
                    if (req.body.value.toString().length > 30) return
                    files.files[e].tag = req.body.value.toString().toLowerCase()
                }
                modified++;
            break;
        }
    })

    writeFile(process.cwd()+"/.data/files.json",JSON.stringify(files.files), (err) => {
        if (err) console.log(err)
        res.contentType("text/plain")
        res.send(`modified ${modified} files`)
    })

})