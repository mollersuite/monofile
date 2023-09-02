import bodyParser from "body-parser";
import { Router } from "express";
import * as Accounts from "../lib/accounts";
import * as auth from "../lib/auth";
import bytes from "bytes"
import {writeFile} from "fs";
import { sendMail } from "../lib/mail";
import { getAccount, requiresAccount, requiresAdmin } from "../lib/middleware"

import ServeError from "../lib/errors";
import Files from "../lib/files";

let parser = bodyParser.json({
    type: ["text/plain","application/json"]
})

export let adminRoutes = Router();
adminRoutes
    .use(getAccount)
    .use(requiresAccount)
    .use(requiresAdmin)
let files:Files

export function setFilesObj(newFiles:Files) {
    files = newFiles
}

let config = require(`${process.cwd()}/config.json`)

adminRoutes.post("/reset", parser, (req,res) => {

    let acc = res.locals.acc as Accounts.Account
    
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
    auth.AuthTokens.filter(e => e.account == targetAccount?.id).forEach((v) => {
        auth.invalidate(v.token)
    })

    if (targetAccount.email) {
        sendMail(targetAccount.email, `Your login details have been updated`, `<b>Hello there!</b> This email is to notify you of a password change that an administrator, <span username>${acc.username}</span>, has initiated. You have been logged out of your devices. Thank you for using monofile.`).then(() => {
            res.send("OK")
        }).catch((err) => {})
    }


    res.send()

})

adminRoutes.post("/elevate", parser, (req,res) => {

    let acc = res.locals.acc as Accounts.Account

    if (typeof req.body.target !== "string") {
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

    targetAccount.admin = true;
    Accounts.save()
    res.send()

})

adminRoutes.post("/delete", parser, (req,res) => {
    
    if (typeof req.body.target !== "string") {
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

    files.unlink(req.body.target).then(() => {
        res.status(200)
    }).catch(() => {
        res.status(500)
    }).finally(() => res.send())

})

adminRoutes.post("/delete_account", parser, async (req,res) => {

    let acc = res.locals.acc as Accounts.Account
    
    if (typeof req.body.target !== "string") {
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

    let accId = targetAccount.id

    auth.AuthTokens.filter(e => e.account == accId).forEach((v) => {
        auth.invalidate(v.token)
    })

    let cpl = () => Accounts.deleteAccount(accId).then(_ => {
        if (targetAccount?.email) {
            sendMail(targetAccount.email, "Notice of account deletion", `Your account, <span username>${targetAccount.username}</span>, has been deleted by <span username>${acc.username}</span> for the following reason: <br><br><span style="font-weight:600">${req.body.reason || "(no reason specified)"}</span><br><br> Your files ${req.body.deleteFiles ? "have been deleted" : "have not been modified"}. Thank you for using monofile.`)
        }
        res.send("account deleted")
    })
    
    if (req.body.deleteFiles) {
        let f = targetAccount.files.map(e=>e) // make shallow copy so that iterating over it doesnt Die
        for (let v of f) {
            files.unlink(v,true).catch(err => console.error(err))
        }

        writeFile(process.cwd()+"/.data/files.json",JSON.stringify(files.files), (err) => {
            if (err) console.log(err)
            cpl()
        })
    } else cpl()
})

adminRoutes.post("/transfer", parser, (req,res) => {
    
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

adminRoutes.post("/idchange", parser, (req,res) => {
    
    if (typeof req.body.target !== "string" || typeof req.body.new !== "string") {
        res.status(400)
        res.send()
        return
    }
    
    let targetFile = files.getFilePointer(req.body.target)
    if (!targetFile) {
        res.status(404)
        res.send()
        return
    }
    
    if (files.getFilePointer(req.body.new)) {
        res.status(400)
        res.send()
        return
    }

    if (targetFile.owner) {
        Accounts.files.deindex(targetFile.owner, req.body.target)
        Accounts.files.index(targetFile.owner, req.body.new)
    }
    delete files.files[req.body.target]

    files.writeFile(req.body.new, targetFile).then(() => {
        res.send()
    }).catch(() => {
        files.files[req.body.target] = req.body.new

        if (targetFile.owner) {
            Accounts.files.deindex(targetFile.owner, req.body.new)
            Accounts.files.index(targetFile.owner, req.body.target)
        }

        res.status(500)
        res.send()
    })

})