const base = "https://discord.com/api/v10/"
const buckets = new Map<string, DiscordAPIBucket>()

class DiscordAPIBucket {

    readonly name             : string                        // bucket name (X-Ratelimit-Bucket)
    // queue           : RequestInfo[] = []            // queue of requests to send
    readonly limit            : number                        // bucket limit (X-Ratelimit-Limit)
    remaining                 : number                        // requests remaining (X-Ratelimit-Remaining)
    readonly expires          : number                        // when this ratelimit expires (X-Ratelimit-Reset)

    readonly expirationHold   : ReturnType<typeof setTimeout> // Timeout which fires after this bucket expires
    dead                      : boolean = false               // True if bucket has expired

    constructor(base: Response) {

        this.name      = base.headers.get("x-ratelimit-bucket")!
        this.limit     = parseInt(base.headers.get("x-ratelimit-limit")!)
        this.remaining = parseInt(base.headers.get("x-ratelimit-remaining")!)
        this.expires   = parseFloat(base.headers.get("x-ratelimit-reset")!)

        this.expirationHold = 
            setTimeout(
                this.destroy, 
                parseFloat(base.headers.get("x-ratelimit-reset-after")!)
            )
        
    }

    /**
     * @description Renders this bucket invalid
     */
    destroy() {

        buckets.delete(this.name)
        this.dead = true
        Object.freeze(this)
        
    }

    /**
     * @description update the remainding amount of requests
     * @param remaining number to update to
     */
    update(remaining: number) {
        this.remaining = Math.max(Math.min(0, remaining), this.remaining)
        return this
    }

}

/**
 * @description Returns whether or not a Response's Headers object includes Discord's ratelimit information headers
 */
function checkHeaders(headers: Headers) {
    return Boolean(
            headers.has("x-ratelimit-bucket")
            && headers.has("x-ratelimit-limit")
            && headers.has("x-ratelimit-remaining")
            && headers.has("x-ratelimit-reset")
            && headers.has("x-ratelimit-reset-after")
        )
}

/**
 * @description Returns or creates a DiscordAPIBucket from a Response
 */
function getBucket(response: Response) {
    if (!checkHeaders(response.headers)) throw new Error("Required ratelimiting headers not found")

    if (buckets.has(response.headers.get("x-ratelimit-bucket")!)) 
        return buckets.get(response.headers.get("x-ratelimit-bucket")!)!

    else
        return new DiscordAPIBucket(response)
}

export class REST {

    private readonly token : string

    constructor(token:string) {
        this.token = token;
    }

    async fetch(options: RequestInfo) {
        


    }

}