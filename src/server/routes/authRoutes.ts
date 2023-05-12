import bodyParser from "body-parser";
import { Router } from "express";
import * as Accounts from "../lib/accounts";
import * as auth from "../lib/auth";

import ServeError from "../lib/errors";
import Files, { FileVisibility, id_check_regex } from "../lib/files";

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
    
    if (typeof req.body.fileId != "string") return

    if (id_check_regex.test(req.body.fileId) && req.body.fileId.length <= config.maxUploadIdLength) {
        acc.customCSS = req.body.fileId
        if (!req.body.fileId) delete acc.customCSS
        Accounts.save()
        res.send(`custom css saved`)
    } else {
        res.status(400)
        res.send("invalid fileid")
    }
})

authRoutes.post("/delete_account", parser, (req,res) => {
    let acc = Accounts.getFromToken(req.cookies.auth)
    if (!acc) {
        ServeError(res, 401, "not logged in")
        return
    }
    let accId = acc.id

    auth.AuthTokens.filter(e => e.account == accId).forEach((v) => {
        auth.invalidate(v.token)
    })
    
    if (req.body.deleteFiles) {
        acc.files.forEach((v) => {
            files.unlink(v)
        })
    }

    Accounts.deleteAccount(accId)

    res.send("account deleted")
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