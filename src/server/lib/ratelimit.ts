import type { Handler } from "hono"
import ServeError from "./errors.js"

interface RatelimitSettings {
    requests: number
    per: number
}

/**
 * @description Ratelimits a route based on ctx.get("account")
 * @param settings Ratelimit settings
 * @returns Express middleware
 */
export function accountRatelimit(settings: RatelimitSettings): Handler {
    let activeLimits: {
        [key: string]: {
            requests: number
            expirationHold: NodeJS.Timeout
        }
    } = {}

    return (ctx, next) => {
        if (ctx.get("account")) {
            let accId = ctx.get("account").id
            let aL = activeLimits[accId]

            if (!aL) {
                activeLimits[accId] = {
                    requests: 0,
                    expirationHold: setTimeout(
                        () => delete activeLimits[accId],
                        settings.per
                    ),
                }
                aL = activeLimits[accId]
            }

            if (aL.requests < settings.requests) {
                ctx.set("undoCount", () => {
                    if (activeLimits[accId]) {
                        activeLimits[accId].requests--
                    }
                })
                return next()
            } else {
                return ServeError(ctx, 429, "too many requests")
            }
        }
    }
}
