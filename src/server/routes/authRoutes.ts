import bodyParser from "body-parser";
import { Router } from "express";
import * as Accounts from "../lib/accounts";
import * as auth from "../lib/auth";

import ServeError from "../lib/errors";

let parser = bodyParser.json({
    type: ["text/plain","application/json"]
})

export let authRoutes = Router();

let config = require(`${process.cwd()}/config.json`)


authRoutes.post("/login", parser, (req,res) => {
    let body:{[key:string]:any}
    try {
        body = JSON.parse(req.body)
    } catch {
        ServeError(res,400,"bad request")
        return
    }

    if (typeof body.username != "string" || typeof body.password != "string") {
        ServeError(res,400,"please provide a username or password")
        return
    }

    if (auth.validate(req.cookies.auth)) return

    /*
        check if account exists  
    */

    let acc = Accounts.getFromUsername(body.username)

    if (!acc) {
        ServeError(res,401,"username or password incorrect")
        return
    }

    if (!Accounts.password.check(acc.id,body.password)) {
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

    let body:{[key:string]:any}
    try {
        body = JSON.parse(req.body)
    } catch {
        ServeError(res,400,"bad request")
        return
    }

    if (auth.validate(req.cookies.auth)) return

    if (typeof body.username != "string" || typeof body.password != "string") {
        ServeError(res,400,"please provide a username or password")
        return
    }

    /*
        check if account exists  
    */

    let acc = Accounts.getFromUsername(body.username)

    if (acc) {
        ServeError(res,400,"account with this username already exists")
        return
    }

    if (body.username.length < 3 || body.username.length > 20) {
        ServeError(res,400,"username must be over or equal to 3 characters or under or equal to 20 characters in length")
        return
    }

    if ((body.username.match(/[A-Za-z0-9_\-\.]+/) || [])[0] != body.username) {
        ServeError(res,400,"username contains invalid characters")
        return
    }

    if (body.password.length < 8) {
        ServeError(res,400,"password must be 8 characters or longer")
        return
    }

    let newAcc = Accounts.create(body.username,body.password)

    /*
        assign token
    */

    res.cookie("auth",auth.create(newAcc,(3*24*60*60*1000)))
    res.status(200)
    res.end()
})

authRoutes.post("/logout", (req,res) => {
    if (!auth.validate(req.cookies.auth)) {
        ServeError(res, 401, "not logged in")
        return
    }

    auth.invalidate(req.cookies.auth)
    res.send("logged out")
})

authRoutes.post("/change_password", (req,res) => {
    let acc = Accounts.getFromToken(req.cookies.auth)
    if (!acc) {
        ServeError(res, 401, "not logged in")
        return
    }

    let body:{[key:string]:any}
    try {
        body = JSON.parse(req.body)
    } catch {
        ServeError(res,400,"bad request")
        return
    }

    if (typeof body.password != "string" || body.password.length < 8) {
        ServeError(res,400,"password must be 8 characters or longer")
        return
    }

    let accId = acc.id

    Accounts.password.set(accId,body.password)

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