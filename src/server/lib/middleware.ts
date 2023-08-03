import * as Accounts from "./accounts";
import express, { type RequestHandler } from "express"
import ServeError from "../lib/errors";

export let getAccount: RequestHandler = function(req, res, next) {
    res.locals.acc = Accounts.getFromToken(req.cookies.auth)
    next()
}

export let requiresAccount: RequestHandler = function(_req, res, next) {
    if (!res.locals.acc) {
        ServeError(res, 401, "not logged in")
        return
    }
    next()
}

export let requiresAdmin: RequestHandler = function(_req, res, next) {
    if (!res.locals.acc.admin) {
        ServeError(res, 403, "you are not an administrator")
        return
    }
    next()
}