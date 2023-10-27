const base = "https://discord.com/api/v10"
const buckets = new Map<string, DiscordAPIBucket>()
const routeConnections = new Map<string, DiscordAPIBucket>()

interface RatelimitData {
    bucket_name : string 
    limit       : number
    remaining   : number
    expires     : number
}

interface QueuedRequest {
    path   : `/${string}`
    params : RequestInit
}

function extractRatelimitData(headers: Headers): RatelimitData {
    return {
        bucket_name : headers.get("x-ratelimit-bucket")!,
        limit       : parseInt(headers.get("x-ratelimit-limit")!),
        remaining   : parseInt(headers.get("x-ratelimit-remaining")!),
        expires     : parseFloat(headers.get("x-ratelimit-reset")!),
    }
}

class DiscordAPIBucket {

    readonly name             : string                        // bucket name (X-Ratelimit-Bucket)
    readonly limit            : number                        // bucket limit (X-Ratelimit-Limit)
    remaining                 : number                        // requests remaining (X-Ratelimit-Remaining)
    readonly expires          : number                        // when this ratelimit expires (X-Ratelimit-Reset)

    readonly expirationHold   : ReturnType<typeof setTimeout> // Timeout which fires after this bucket expires
    dead                      : boolean  = false              // True if bucket has expired
    linked_routes             : string[] = []

    constructor(base: Response) {

        let rd = extractRatelimitData(base.headers)

        this.name      = rd.bucket_name
        this.limit     = rd.limit
        this.remaining = rd.remaining
        this.expires   = rd.expires

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
        this.linked_routes.forEach((v) => routeConnections.delete(v))
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

    /**
     * @description Link a route to this bucket
     * @param route Route to link
     */
    link(route: string) {
        if (this.linked_routes.includes(route)) return
        routeConnections.set(route, this)
        this.linked_routes.push(route)
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
function getBucket(response: string): DiscordAPIBucket | undefined
function getBucket(response: Response): DiscordAPIBucket
function getBucket(response: Response | string) {
    if (response instanceof Response) {
        if (!checkHeaders(response.headers)) throw new Error("Required ratelimiting headers not found")

        if (buckets.has(response.headers.get("x-ratelimit-bucket")!)) 
            return buckets.get(response.headers.get("x-ratelimit-bucket")!)!

        else
            return new DiscordAPIBucket(response)
    } else return routeConnections.get(response)
}

export class REST {

    private readonly token : string

    constructor(token:string) {
        this.token = token;
    }

    /**
     * @description Queues a request 
     */
    async queue(path: `/${string}`, options?: RequestInit) {
        // TODO: actually write the queue lmao
        console.warn(`Request added to queue: ${(options?.method ?? "get").toUpperCase()} ${path}`)
    }

    /**
     * @description Make a fetch requests where further requests are automatically queued in case of ratelimit
     */
    async fetch(path: `/${string}`, options?: RequestInit) {

        // check if there's already a bucket, and check if it's full
        let known_bucket = getBucket( path )

        if (known_bucket && known_bucket.remaining) {
            return this.queue(path, options)
        }

        // there's no known bucket for this route; let's carry on with the request
        let response = await fetch(base+path, options)

        if ( checkHeaders(response.headers) ) {
            // a ratelimit is attached, let's set up our buckets..

            let bucket = getBucket( response )
            if (response.status == 429) {
                bucket.link(path) // link the bucket so that hopefully no future errors occur

                return this.queue(path, options) /* it was ratelimited after all
                                                    getBucket() would have generated a DiscordAPIBucket
                                                    so this would be fine */
            }

            // let's update the bucket...
            let rd = extractRatelimitData( response.headers )
            bucket.update(rd.remaining)

        } else return response

    }

}
