import * as Accounts from "./accounts";
import express, { type RequestHandler } from "express"
import ServeError from "../lib/errors";
import * as auth from "./auth";

function tokenFor(req: express.Request) {
    return req.cookies.auth || (
        req.header("authorization")?.startsWith("Bearer ")
        ? req.header("authorization")?.split(" ")[1]
        : undefined
    )
}

export const getAccount: RequestHandler = function(req, res, next) {
    res.locals.acc = Accounts.getFromToken(tokenFor(req))
    next()
}

export const requiresAccount: RequestHandler = function(_req, res, next) {
    if (!res.locals.acc) {
        ServeError(res, 401, "not logged in")
        return
    }
    next()
}

export const requiresAdmin: RequestHandler = function(_req, res, next) {
    if (!res.locals.acc.admin) {
        ServeError(res, 403, "you are not an administrator")
        return
    }
    next()
}

export namespace apiBlockers {

    /**
     * @description Blocks requests based on the permissions which a token has. Does not apply to routes being accessed with a token of type `User`
     * @param tokenPermissions Permissions which your route requires.
     * @returns Express middleware
     */

    export const requiresPermissions = function(...tokenPermissions: auth.TokenPermission[]): RequestHandler {
        return function(req, res, next) {
            let token = tokenFor(req)
            let type = auth.getType(token)
            
            if (type == "App") {
                let permissions = auth.getPermissions(token)
                
                if (!permissions) ServeError(res, 403, "insufficient permissions")
                else {

                    for (let v in tokenPermissions) 
                        if (!permissions.includes(v as auth.TokenPermission)) {
                            ServeError(res,403,"insufficient permissions")
                            return
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
        if (auth.getType(tokenFor(req)) == "App") ServeError(res, 403, "apps are not allowed to access this endpoint")
        else next()
    }

}