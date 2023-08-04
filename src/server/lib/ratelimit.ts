import { RequestHandler } from "express"
import { type Account } from "./accounts"
import ServeError from "./errors"

interface ratelimitSettings {

    requests: number
    per: number

}

export function accountRatelimit( settings: ratelimitSettings ): RequestHandler {
    let activeLimits: {
        [ key: string ]: {
            requests: number,
            expirationHold: NodeJS.Timeout
        }
    } = {}

    return (req, res, next) => {
        if (res.locals.acc) {
            let accId = res.locals.acc.id
            let aL = activeLimits[accId]
            
            if (!aL) {
                activeLimits[accId] = {
                    requests: 0,
                    expirationHold: setTimeout(() => delete activeLimits[accId], settings.per)
                }
                aL = activeLimits[accId]
            }

            if (aL.requests < settings.requests) {
                res.locals.undoCount = () => {
                    if (activeLimits[accId]) {
                        activeLimits[accId].requests--
                    }
                }
                next()
            } else {
                ServeError(res, 429, "too many requests")
            }
        }
    }
}