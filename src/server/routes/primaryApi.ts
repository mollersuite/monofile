import bodyParser from "body-parser";
import express, { Router } from "express";
import * as Accounts from "../lib/accounts";
import * as auth from "../lib/auth";
import axios, { AxiosResponse } from "axios"
import { type Range } from "range-parser";
import multer, {memoryStorage} from "multer"

import ServeError from "../lib/errors";
import Files from "../lib/files";
import { getAccount, requiresPermissions } from "../lib/middleware";

let parser = bodyParser.json({
    type: ["text/plain","application/json"]
})

export let primaryApi = Router();
let files:Files

export function setFilesObj(newFiles:Files) {
    files = newFiles
}

const multerSetup = multer({storage:memoryStorage()})

let config = require(`${process.cwd()}/config.json`)

primaryApi.use(getAccount);

primaryApi.get(["/file/:fileId", "/cpt/:fileId/*", "/:fileId"], async (req:express.Request,res:express.Response) => {
    
    let acc = res.locals.acc as Accounts.Account

    let file = files.getFilePointer(req.params.fileId)
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Content-Security-Policy","sandbox allow-scripts")
    if (req.query.attachment == "1") res.setHeader("Content-Disposition", "attachment")
    
    if (file) {
        
        if (file.visibility == "private" && acc?.id != file.owner) {
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

// upload handlers

primaryApi.post("/upload", requiresPermissions("upload"), multerSetup.single('file'), async (req,res) => {
    
    let acc = res.locals.acc as Accounts.Account

    if (req.file) {
        try {
            let prm = req.header("monofile-params")
            let params:{[key:string]:any} = {}
            if (prm) {
                params = JSON.parse(prm)
            }

            files.uploadFile({
                owner: acc?.id,

                uploadId:params.uploadId,
                name:req.file.originalname,
                mime:req.file.mimetype
            },req.file.buffer)
                .then((uID) => res.send(uID))
                .catch((stat) => {
                    res.status(stat.status);
                    res.send(`[err] ${stat.message}`)
                })
        } catch {
            res.status(400)
            res.send("[err] bad request")
        }
    } else {
        res.status(400)
        res.send("[err] bad request")
    }
})

primaryApi.post("/clone", requiresPermissions("upload"), bodyParser.json({type: ["text/plain","application/json"]}) ,(req,res) => {
    
    let acc = res.locals.acc as Accounts.Account

    try {
        axios.get(req.body.url,{responseType:"arraybuffer"}).then((data:AxiosResponse) => {

            files.uploadFile({
                owner: acc?.id,

                name:req.body.url.split("/")[req.body.url.split("/").length-1] || "generic",
                mime:data.headers["content-type"],
                uploadId:req.body.uploadId
            },Buffer.from(data.data))
                .then((uID) => res.send(uID))
                .catch((stat) => {
                    res.status(stat.status);
                    res.send(`[err] ${stat.message}`)
                })

        }).catch((err) => {
            console.log(err)
            res.status(400)
            res.send(`[err] failed to fetch data`)
        })
    } catch {
        res.status(500)
        res.send("[err] an error occured")
    }
})