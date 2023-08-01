import bodyParser from "body-parser";
import { Router } from "express";
import * as Accounts from "../lib/accounts";
import * as auth from "../lib/auth";
import { sendMail } from "../lib/mail";

import ServeError from "../lib/errors";
import Files, { FileVisibility, generateFileId, id_check_regex } from "../lib/files";

import { writeFile } from "fs";

let parser = bodyParser.json({
    type: ["text/plain","application/json"]
})

export let authRoutes = Router();

let config = require(`${process.cwd()}/config.json`)

let files:Files

export function auth_setFilesObj(newFiles:Files) {
    files = newFiles
}

authRoutes.post("/login", parser, (req,res) => {
    if (typeof req.body.username != "string" || typeof req.body.password != "string") {
        ServeError(res,400,"please provide a username or password")
        return
    }

    if (auth.validate(req.cookies.auth)) return

    /*
        check if account exists  
    */

    let acc = Accounts.getFromUsername(req.body.username)

    if (!acc) {
        ServeError(res,401,"username or password incorrect")
        return
    }

    if (!Accounts.password.check(acc.id,req.body.password)) {
        ServeError(res,401,"username or password incorrect")
        return
    }

    /*
        assign token
    */

    res.cookie("auth",auth.create(acc.id,(3*24*60*60*1000)))
    res.status(200)
    res.end()
})

authRoutes.post("/create", parser, (req,res) => {
    if (!config.accounts.registrationEnabled) {
        ServeError(res,403,"account registration disabled")
        return
    }

    if (auth.validate(req.cookies.auth)) return

    if (typeof req.body.username != "string" || typeof req.body.password != "string") {
        ServeError(res,400,"please provide a username or password")
        return
    }

    /*
        check if account exists  
    */

    let acc = Accounts.getFromUsername(req.body.username)

    if (acc) {
        ServeError(res,400,"account with this username already exists")
        return
    }

    if (req.body.username.length < 3 || req.body.username.length > 20) {
        ServeError(res,400,"username must be over or equal to 3 characters or under or equal to 20 characters in length")
        return
    }

    if ((req.body.username.match(/[A-Za-z0-9_\-\.]+/) || [])[0] != req.body.username) {
        ServeError(res,400,"username contains invalid characters")
        return
    }

    if (req.body.password.length < 8) {
        ServeError(res,400,"password must be 8 characters or longer")
        return
    }

    Accounts.create(req.body.username,req.body.password)
        .then((newAcc) => {
            /*
                assign token
            */

            res.cookie("auth",auth.create(newAcc,(3*24*60*60*1000)))
            res.status(200)
            res.end()
        })
        .catch(() => {
            ServeError(res,500,"internal server error")
        })
})

authRoutes.post("/logout", (req,res) => {
    if (!auth.validate(req.cookies.auth)) {
        ServeError(res, 401, "not logged in")
        return
    }

    auth.invalidate(req.cookies.auth)
    res.send("logged out")
})

authRoutes.post("/dfv", parser, (req,res) => {
    let acc = Accounts.getFromToken(req.cookies.auth)
    if (!acc) {
        ServeError(res, 401, "not logged in")
        return
    }

    if (['public','private','anonymous'].includes(req.body.defaultFileVisibility)) {
        acc.defaultFileVisibility = req.body.defaultFileVisibility
        Accounts.save()
        res.send(`dfv has been set to ${acc.defaultFileVisibility}`)
    } else {
        res.status(400)
        res.send("invalid dfv")
    }
})

authRoutes.post("/customcss", parser, (req,res) => {
    let acc = Accounts.getFromToken(req.cookies.auth)
    if (!acc) {
        ServeError(res, 401, "not logged in")
        return
    }
    
    if (typeof req.body.fileId != "string") req.body.fileId = undefined;
    
    if (

        !req.body.fileId
        || (req.body.fileId.match(id_check_regex) == req.body.fileId 
        && req.body.fileId.length <= config.maxUploadIdLength)
        
    ) {
        acc.customCSS = req.body.fileId || undefined
        if (!req.body.fileId) delete acc.customCSS
        Accounts.save()
        res.send(`custom css saved`)
    } else {
        res.status(400)
        res.send("invalid fileid")
    }
})

authRoutes.post("/embedcolor", parser, (req,res) => {
    let acc = Accounts.getFromToken(req.cookies.auth)
    if (!acc) {
        ServeError(res, 401, "not logged in")
        return
    }
    
    if (typeof req.body.color != "string") req.body.color = undefined;
    
    if (

        !req.body.color
        || (req.body.color.toLowerCase().match(/[a-f0-9]+/) == req.body.color)
        && req.body.color.length == 6
        
    ) {
        if (!acc.embed) acc.embed = {}
        acc.embed.color = req.body.color || undefined
        if (!req.body.color) delete acc.embed.color
        Accounts.save()
        res.send(`custom embed color saved`)
    } else {
        res.status(400)
        res.send("invalid hex code")
    }
})

authRoutes.post("/embedsize", parser, (req,res) => {
    let acc = Accounts.getFromToken(req.cookies.auth)
    if (!acc) {
        ServeError(res, 401, "not logged in")
        return
    }
    
    if (typeof req.body.largeImage != "boolean") req.body.color = false;

    if (!acc.embed) acc.embed = {}
    acc.embed.largeImage = req.body.largeImage
    if (!req.body.largeImage) delete acc.embed.largeImage
    Accounts.save()
    res.send(`custom embed image size saved`)
})

authRoutes.post("/delete_account", parser, async (req,res) => {
    let acc = Accounts.getFromToken(req.cookies.auth)
    if (!acc) {
        ServeError(res, 401, "not logged in")
        return
    }
    let accId = acc.id

    auth.AuthTokens.filter(e => e.account == accId).forEach((v) => {
        auth.invalidate(v.token)
    })

    let cpl = () => Accounts.deleteAccount(accId).then(_ => res.send("account deleted"))
    
    if (req.body.deleteFiles) {
        let f = acc.files.map(e=>e) // make shallow copy so that iterating over it doesnt Die
        for (let v of f) {
            files.unlink(v,true).catch(err => console.error(err))
        }

        writeFile(process.cwd()+"/.data/files.json",JSON.stringify(files.files), (err) => {
            if (err) console.log(err)
            cpl()
        })
    } else cpl()
})

authRoutes.post("/change_username", parser, (req,res) => {
    let acc = Accounts.getFromToken(req.cookies.auth)
    if (!acc) {
        ServeError(res, 401, "not logged in")
        return
    }

    if (typeof req.body.username != "string" || req.body.username.length < 3 || req.body.username.length > 20) {
        ServeError(res,400,"username must be between 3 and 20 characters in length")
        return
    }

    let _acc = Accounts.getFromUsername(req.body.username)

    if (_acc) {
        ServeError(res,400,"account with this username already exists")
        return
    }

    if ((req.body.username.match(/[A-Za-z0-9_\-\.]+/) || [])[0] != req.body.username) {
        ServeError(res,400,"username contains invalid characters")
        return
    }

    acc.username = req.body.username
    Accounts.save()

    res.send("username changed")
})

// shit way to do this but...

let verificationCodes = new Map<string, {code: string, email: string, expiry: NodeJS.Timeout, requestedAt:number}>()

authRoutes.post("/request_email_change", parser, (req,res) => {
    let acc = Accounts.getFromToken(req.cookies.auth)
    if (!acc) {
        ServeError(res, 401, "not logged in")
        return
    }
    
    if (typeof req.body.email != "string" || !req.body.email) {
        ServeError(res,400, "supply an email")
        return
    }

    let vcode = verificationCodes.get(acc.id) 

    if (vcode && vcode.requestedAt+(15*60*1000) > Date.now()) {
        ServeError(res, 429, `Please wait a few moments to request another email change.`)
        return
    }


    // delete previous if any
    let e = vcode?.expiry
    if (e) clearTimeout(e)
    verificationCodes.delete(acc?.id||"")

    let code = generateFileId(12).toUpperCase()

    // set

    verificationCodes.set(acc.id, {
        code,
        email: req.body.email,
        expiry: setTimeout( () => verificationCodes.delete(acc?.id||""), 15*60*1000),
        requestedAt: Date.now()
    })

    // this is a mess but it's fine

    sendMail(req.body.email, `Hey there, ${acc.username} - let's connect your email`, `<b>Hello there!</b> You are recieving this message because you decided to link your email, <span code>${req.body.email.split("@")[0]}<span style="opacity:0.5">@${req.body.email.split("@")[1]}</span></span>, to your account, <span username>${acc.username}</span>. If you would like to continue, please <a href="https://${req.header("Host")}/auth/confirm_email/${code}"><span code>click here</span></a>, or go to https://${req.header("Host")}/auth/confirm_email/${code}.`).then(() => {
        res.send("OK")
    }).catch((err) => {
        let e = verificationCodes.get(acc?.id||"")?.expiry
        if (e) clearTimeout(e)
        verificationCodes.delete(acc?.id||"")
        ServeError(res, 500, err?.toString())
    })
})

authRoutes.get("/confirm_email/:code", (req,res) => {
    let acc = Accounts.getFromToken(req.cookies.auth)
    if (!acc) {
        ServeError(res, 401, "not logged in")
        return
    }

    let vcode = verificationCodes.get(acc.id)

    if (!vcode) { ServeError(res, 400, "nothing to confirm"); return }

    if (typeof req.params.code == "string" && req.params.code.toUpperCase() == vcode.code) {
        acc.email = vcode.email
        Accounts.save();

        let e = verificationCodes.get(acc?.id||"")?.expiry
        if (e) clearTimeout(e)
        verificationCodes.delete(acc?.id||"")

        res.send(`<script>window.close()</script>`)
    } else {
        ServeError(res, 400, "invalid code")
    }
})

let pwReset = new Map<string, {code: string, expiry: NodeJS.Timeout, requestedAt:number}>()
let prcIdx = new Map<string, string>()

authRoutes.post("/request_emergency_login", parser, (req,res) => {
    if (auth.validate(req.cookies.auth || "")) return
    
    if (typeof req.body.account != "string" || !req.body.account) {
        ServeError(res,400, "supply a username")
        return
    }

    let acc = Accounts.getFromUsername(req.body.account)
    if (!acc || !acc.email) {
        ServeError(res, 400, "this account either does not exist or does not have an email attached; please contact the server's admin for a reset if you would still like to access it")
        return
    }

    let pResetCode = pwReset.get(acc.id) 

    if (pResetCode && pResetCode.requestedAt+(15*60*1000) > Date.now()) {
        ServeError(res, 429, `Please wait a few moments to request another emergency login.`)
        return
    }


    // delete previous if any
    let e = pResetCode?.expiry
    if (e) clearTimeout(e)
    pwReset.delete(acc?.id||"")
    prcIdx.delete(pResetCode?.code||"")

    let code = generateFileId(12).toUpperCase()

    // set

    pwReset.set(acc.id, {
        code,
        expiry: setTimeout( () => { pwReset.delete(acc?.id||""); prcIdx.delete(pResetCode?.code||"") }, 15*60*1000),
        requestedAt: Date.now()
    })

    prcIdx.set(code, acc.id)

    // this is a mess but it's fine

    sendMail(acc.email, `Emergency login requested for ${acc.username}`, `<b>Hello there!</b> You are recieving this message because you forgot your password to your monofile account, <span username>${acc.username}</span>. To log in, please <a href="https://${req.header("Host")}/auth/emergency_login/${code}"><span code>click here</span></a>, or go to https://${req.header("Host")}/auth/emergency_login/${code}. If it doesn't appear that you are logged in after visiting this link, please try refreshing. Once you have successfully logged in, you may reset your password.`).then(() => {
        res.send("OK")
    }).catch((err) => {
        let e = pwReset.get(acc?.id||"")?.expiry
        if (e) clearTimeout(e)
        pwReset.delete(acc?.id||"")
        prcIdx.delete(code||"")
        ServeError(res, 500, err?.toString())
    })
})

authRoutes.get("/emergency_login/:code", (req,res) => {
    if (auth.validate(req.cookies.auth || "")) {
        ServeError(res, 403, "already logged in")
        return
    }

    let vcode = prcIdx.get(req.params.code)

    if (!vcode) { ServeError(res, 400, "invalid emergency login code"); return }

    if (typeof req.params.code == "string" && vcode) {
        res.cookie("auth",auth.create(vcode,(3*24*60*60*1000)))
        res.redirect("/")

        let e = pwReset.get(vcode)?.expiry
        if (e) clearTimeout(e)
        pwReset.delete(vcode)
        prcIdx.delete(req.params.code)
    } else {
        ServeError(res, 400, "invalid code")
    }
})

authRoutes.post("/change_password", parser, (req,res) => {
    let acc = Accounts.getFromToken(req.cookies.auth)
    if (!acc) {
        ServeError(res, 401, "not logged in")
        return
    }

    if (typeof req.body.password != "string" || req.body.password.length < 8) {
        ServeError(res,400,"password must be 8 characters or longer")
        return
    }

    let accId = acc.id

    Accounts.password.set(accId,req.body.password)

    auth.AuthTokens.filter(e => e.account == accId).forEach((v) => {
        auth.invalidate(v.token)
    })

    res.send("password changed - logged out all sessions")
})

authRoutes.post("/logout_sessions", (req,res) => {
    let acc = Accounts.getFromToken(req.cookies.auth)
    if (!acc) {
        ServeError(res, 401, "not logged in")
        return
    }

    let accId = acc.id

    auth.AuthTokens.filter(e => e.account == accId).forEach((v) => {
        auth.invalidate(v.token)
    })

    res.send("logged out all sessions")
})

authRoutes.get("/me", (req,res) => {
    if (!auth.validate(req.cookies.auth)) {
        ServeError(res, 401, "not logged in")
        return
    }
    
    // lazy rn so

    let acc = Accounts.getFromToken(req.cookies.auth)
    if (acc) {
        let accId = acc.id
        res.send({
            ...acc,
            sessionCount: auth.AuthTokens.filter(e => e.account == accId && e.expire > Date.now()).length,
            sessionExpires: auth.AuthTokens.find(e => e.token == req.cookies.auth)?.expire
        })
    }
})

authRoutes.get("/customCSS", (req,res) => {
    if (!auth.validate(req.cookies.auth)) {
        ServeError(res, 401, "not logged in")
        return
    }
    
    // lazy rn so

    let acc = Accounts.getFromToken(req.cookies.auth)
    if (acc) {
        if (acc.customCSS) {
            res.redirect(`/file/${acc.customCSS}`)
        } else {
            res.send("")
        }
    } else res.send("")
})