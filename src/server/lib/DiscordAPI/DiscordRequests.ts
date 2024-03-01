// working around typescript cause i can't think of anything better :upside_down:
import { type RequestInfo, type RequestInit, type Response, Headers } from "node-fetch"

// I jerk off to skibidi toilet. His smile is so fucking hot, oh my god, oh. 
// The voices are getting louder, help me. Oh god, i want to put it inside that toilet and make him beg. 
// Whenever i see skibidi toilet cum comes out like a waterfall. 
// Whenever my classmates say anything about toilets the entire school gets flooded with cum everywhere. 
// Dafuqboom is truly the best artist of all time.

let ftch_dft: (url: URL | RequestInfo, init?:RequestInit) => Promise<Response>
const fetch = async (url: URL | RequestInfo, init?:RequestInit) => {
    if (ftch_dft) return ftch_dft(url, init)
    else {
        ftch_dft = (await import("node-fetch")).default;
        return ftch_dft(url, init)
    }
}

const base = "https://discord.com/api/v10"
const buckets = new Map<string, DiscordAPIBucket>()
const routeConnections = new Map<string, DiscordAPIBucket>()

interface RatelimitData {
    bucket_name : string 
    limit       : number
    remaining   : number
    expires     : number
}

/**
 * @description Hold a {@link REST.fetch} to be executed later
 * @param rest {@link REST} to execute {@link REST.fetch|fetch()} on
 * @param path Path for your request
 * @param params Params for your request
 * @returns An object which contains a {@link Promise}: `promise`, which resolves after `execute` is called
 */
function heldFetch( rest: REST, path: `/${string}`, params?: RequestInit ) {
    let resolve: (_:Response) => any
    
    return {

        promise: new Promise<Response>(res => resolve = res),

        async execute() {
            let response = await rest.fetch(path, params)
            resolve(response)
            return response
        }

    }
}

/**
 * @description Extracts data on ratelimits from headers
 * @param headers {@link Headers} object to extract information from
 */
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
    readonly parent           : REST                          // parent REST

    readonly expirationHold   : ReturnType<typeof setTimeout> // Timeout which fires after this bucket expires
    dead                      : boolean  = false              // True if bucket has expired
    linked_routes             : `/${string}`[] = []           // Routes linked to this bucket

    constructor(rest: REST, base: Headers) {

        let rd = extractRatelimitData(base)

        this.parent    = rest
        this.name      = rd.bucket_name || Math.random().toString()
        this.limit     = rd.limit
        this.remaining = rd.remaining
        this.expires   = rd.expires

        this.expirationHold = 
            setTimeout(
                this.destroy.bind(this), 
                parseFloat(base.get("x-ratelimit-reset-after")!)
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

        // execute queued requests...
        // @Jack5079 i have no idea if there's a better way to do this
        // fix it if there is one after you wake up
        let requestsToExecute: (ReturnType<typeof heldFetch>["execute"])[] = []
        this.linked_routes.forEach((v) => {
            let queue = this.parent.requestQueue[v]
            if (queue)
                requestsToExecute.push(
                    ...queue.splice(
                        0, 
                        Math.min( this.limit-requestsToExecute.length, queue.length )
                    )
                )
        })
        requestsToExecute.forEach(a=>a())
        
    }

    /**
     * @description Link a route to this bucket
     * @param route Route to link
     */
    link(route: `/${string}`) {
        if (this.linked_routes.includes(route)) return
        routeConnections.set(route, this)
        this.linked_routes.push(route)
    }
}

/**
 * @description Returns whether or not a Response's Headers object includes Discord's ratelimit information headers
 * @param headers {@link Headers} object to extract information from
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
 * @description Returns or creates a {@link DiscordAPIBucket} from a Response
 * @param response Response or route to get a DiscordAPIBucket from
 */
function getBucket(response: string): DiscordAPIBucket | undefined
function getBucket(rest: REST, headers: Headers): DiscordAPIBucket
function getBucket(rest: REST | string, headers?: Headers) {
    if (headers instanceof Headers && rest instanceof REST) {
        if (!checkHeaders(headers)) throw new Error("Required ratelimiting headers not found")

        if (buckets.has(headers.get("x-ratelimit-bucket")!)) 
            return buckets.get(headers.get("x-ratelimit-bucket")!)!
        else
            return new DiscordAPIBucket(rest, headers)
    } else if (typeof rest == "string") return routeConnections.get(rest)
}

export class REST {

    private readonly token : string
    requestQueue: {[key: `/${string}`]: (ReturnType<typeof heldFetch>["execute"])[]} = {}

    constructor(token:string) {
        this.token = token;
    }

    /**
     * @description Queues a request 
     * @param path Path to request
     * @param options Options for your request
     */
    queue(path: `/${string}`, options?: RequestInit) {
        console.warn(`Request added to queue: ${(options?.method ?? "get").toUpperCase()} ${path}`)

        let {promise, execute} = heldFetch(this, path, options)

        if (!this.requestQueue[path])
            this.requestQueue[path] = []

        this.requestQueue[path].push(execute)
        
        return promise
    }

    /**
     * @description Make a fetch requests where further requests are automatically queued in case of ratelimit
     * @param path Path to request
     * @param options Options for your request
     */
    async fetch(path: `/${string}`, options?: RequestInit) {

        // check if there's already a bucket, and check if it's full
        let known_bucket = getBucket( path )

        if (known_bucket) {
            if (known_bucket.remaining <= 0) return this.queue(path, options)
            else known_bucket.remaining--
        }

        // there's no known bucket for this route; let's carry on with the request                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                
        let response = await fetch(base+path, {
            ...options,
            headers: {
                ...options?.headers,
                Authorization: `Bot ${this.token}`
            }
        })

        if ( checkHeaders(response.headers) ) {
            if (response.status == 429) {
                let bucket = getBucket( this, response.headers )
                bucket.link(path) // link the bucket so that hopefully no future errors occur

                return this.queue(path, options) /* it was ratelimited after all
                                                    getBucket() would have generated a DiscordAPIBucket
                                                    so this would be fine */
            } 
            /* commented out cause i feel like it'll cause issues
                // let's update the bucket with data from the source now
                let rd = extractRatelimitData( response.headers )
                bucket.remaining = rd.remaining
            */
        }
        
        return response

    }

}
