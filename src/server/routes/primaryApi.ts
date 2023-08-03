import bodyParser from "body-parser";
import express, { Router } from "express";
import * as Accounts from "../lib/accounts";
import * as auth from "../lib/auth";
import bytes from "bytes"
import {writeFile} from "fs";
import { type Range } from "range-parser";

import ServeError from "../lib/errors";
import Files from "../lib/files";

let parser = bodyParser.json({
    type: ["text/plain","application/json"]
})

export let primaryApi = Router();
let files:Files

export function setFilesObj(newFiles:Files) {
    files = newFiles
}

let config = require(`${process.cwd()}/config.json`)


primaryApi.get(["/file/:fileId", "/cpt/:fileId/*", "/:fileId"], async (req:express.Request,res:express.Response) => {
    
    let file = files.getFilePointer(req.params.fileId)
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Content-Security-Policy","sandbox allow-scripts")
    if (req.query.attachment == "1") res.setHeader("Content-Disposition", "attachment")
    
    if (file) {
        
        if (file.visibility == "private" && Accounts.getFromToken(req.cookies.auth)?.id != file.owner) {
            ServeError(res,403,"you do not own this file")
            return
        }

        let range: Range | undefined

        res.setHeader("Content-Type",file.mime)
        if (file.sizeInBytes) {
            res.setHeader("Content-Length",file.sizeInBytes)
            
            if (file.chunkSize) {
                let rng = req.range(file.sizeInBytes)
                if (rng) {

                    // error handling
                    if (typeof rng == "number") {
                        res.status(rng == -1 ? 416 : 400).send()
                        return
                    }
                    if (rng.type != "bytes") {
                        res.status(400).send();
                        return
                    }

                    // set ranges var
                    let rngs = Array.from(rng)
                    if (rngs.length != 1) { res.status(400).send(); return }
                    range = rngs[0]
                    
                }
            }
        }

        // supports ranges
        

        files.readFileStream(req.params.fileId, range).then(async stream => {

            if (range) {
                res.status(206)
                res.header("Content-Length", (range.end-range.start + 1).toString())
                res.header("Content-Range", `bytes ${range.start}-${range.end}/${file.sizeInBytes}`)
            }
            stream.pipe(res)
            
        }).catch((err) => {
            ServeError(res,err.status,err.message)
        })

    } else {
        ServeError(res, 404, "file not found")
    }
    
})

primaryApi.head(["/file/:fileId", "/cpt/:fileId/*", "/:fileId"], (req: express.Request, res:express.Response) => {
    let file = files.getFilePointer(req.params.fileId)
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Content-Security-Policy","sandbox allow-scripts")
    if (req.query.attachment == "1") res.setHeader("Content-Disposition", "attachment")
    if (!file) {
        res.status(404)
        res.send()
    } else {
        res.setHeader("Content-Type",file.mime)
        if (file.sizeInBytes) {
            res.setHeader("Content-Length",file.sizeInBytes)
        }
        if (file.chunkSize) {
            res.setHeader("Accept-Ranges", "bytes")
        }
    }
})
