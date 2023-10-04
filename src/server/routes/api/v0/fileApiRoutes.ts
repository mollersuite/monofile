import bodyParser from "body-parser";
import { Router } from "express";
import * as Accounts from "../../../lib/accounts";
import * as auth from "../../../lib/auth";
import bytes from "bytes"
import {writeFile} from "fs";

import ServeError from "../../../lib/errors";
import Files from "../../../lib/files";
import { getAccount, requiresAccount, requiresPermissions } from "../../../lib/middleware";

let parser = bodyParser.json({
    type: ["text/plain","application/json"]
})

export let fileApiRoutes = Router();

let config = require(`${process.cwd()}/config.json`)


module.exports =  function(files: Files) {

    fileApiRoutes.use(getAccount);

    fileApiRoutes.get("/list", requiresAccount, requiresPermissions("user"), (req,res) => {

        let acc = res.locals.acc as Accounts.Account
        
        if (!acc) return
        let accId = acc.id

        res.send(acc.files.map((e) => {
            let fp = files.getFilePointer(e)
            if (!fp) { Accounts.files.deindex(accId, e); return null }
            return {
                ...fp,
                messageids: null,
                owner: null,
                id:e
            }
        }).filter(e=>e))

    })

    fileApiRoutes.post("/manage", parser, requiresPermissions("manage"), (req,res) => {

        let acc = res.locals.acc as Accounts.Account
        
        if (!acc) return
        if (!req.body.target || !(typeof req.body.target == "object") || req.body.target.length < 1) return

        let modified = 0
        
        req.body.target.forEach((e:string) => {
            if (!acc.files.includes(e)) return

            let fp = files.getFilePointer(e)

            if (fp.reserved) {
                return
            }

            switch( req.body.action ) {
                case "delete":
                    files.unlink(e, true)
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

        Accounts.save().then(() => {
            writeFile(process.cwd()+"/.data/files.json",JSON.stringify(files.files), (err) => {
                if (err) console.log(err)
                res.contentType("text/plain")
                res.send(`modified ${modified} files`)
            })
        }).catch((err) => console.error(err))
        

    })

    return fileApiRoutes
}