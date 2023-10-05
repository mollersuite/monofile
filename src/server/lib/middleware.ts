import { Account } from "./accounts";
import express, { type RequestHandler } from "express"
import ServeError from "../lib/errors";
import * as auth from "./auth";

/**
 * @description Middleware which adds an account, if any, to res.locals.acc 
 */
export const getAccount: RequestHandler = function(req, res, next) {
    res.locals.acc = Accounts.getFromToken(auth.tokenFor(req))
    next()
}

/**
 * @description Middleware which blocks requests which do not have res.locals.acc set
 */
export const requiresAccount: RequestHandler = function(_req, res, next) {
    if (!res.locals.acc) {
        ServeError(res, 401, "not logged in")
        return
    }
    next()
}

/**
 * @description Middleware which blocks requests that have res.locals.acc.admin set to a falsy value
 */
export const requiresAdmin: RequestHandler = function(_req, res, next) {
    if (!res.locals.acc.admin) {
        ServeError(res, 403, "you are not an administrator")
        return
    }
    next()
}

/**
 * @description Blocks requests based on the permissions which a token has. Does not apply to routes being accessed with a token of type `User`
 * @param tokenPermissions Permissions which your route requires.
 * @returns Express middleware
 */

export const requiresPermissions = function(...tokenPermissions: auth.TokenPermission[]): RequestHandler {
    return function(req, res, next) {
        let token = auth.tokenFor(req)
        let type = auth.getType(token)
        
        if (type == "App") {
            let permissions = auth.getPermissions(token)
            
            if (!permissions) ServeError(res, 403, "insufficient permissions")
            else {

                for (let v of tokenPermissions) {
                    if (!permissions.includes(v as auth.TokenPermission)) {
                        ServeError(res,403,"insufficient permissions")
                        return
                    }
                }
                next()

            }
        } else next()
    }
}

/**
 * @description Blocks requests based on whether or not the token being used to access the route is of type `User`.  
 */

export const noAPIAccess: RequestHandler = function(req, res, next) {
    if (auth.getType(auth.tokenFor(req)) == "App") ServeError(res, 403, "apps are not allowed to access this endpoint")
    else next()
}

/**
 * @description Blocks requests based on whether or not the token being used to access the route is of type `User` unless a condition is met.
 * @param condition Permissions which your route requires.
 * @returns Express middleware
 */

export const noAPIAccessIf = function(condition: (acc:Account, token:string) => boolean):RequestHandler {
    return function(req, res, next) {
        let reqToken = auth.tokenFor(req)
        if (auth.getType(reqToken) == "App" && !condition(res.locals.acc, reqToken)) ServeError(res, 403, "apps are not allowed to access this endpoint")
        else next()
    }
}

type SchemeType = "array" | "object" | "string" | "number" | "boolean"

interface SchemeObject {
    type: "object"
    children: {
        [key: string]: SchemeParameter
    }
}

interface SchemeArray {
    type: "array",
    children: SchemeParameter /* All children of the array must be this type */ 
            | SchemeParameter[] /* Array must match this pattern */
}

type SchemeParameter = SchemeType | SchemeObject | SchemeArray

/**
 * @description Blocks requests based on whether or not the token being used to access the route is of type `User` unless a condition is met.
 * @param tokenPermissions Permissions which your route requires.
 * @returns Express middleware
 */

export const sanitize = function(scheme: SchemeObject):RequestHandler {
    return function(req, res, next) {
        
    }
}