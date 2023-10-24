import { Response } from "express";
import { readFile } from "fs/promises"

let errorPage:string

/**
 * @description Serves an error as a response to a request with an error page attached
 * @param res Express response object
 * @param code Error code
 * @param reason Error reason
 */
export default async function ServeError(
    res:Response,
    code:number,
    reason:string
) {
    // fetch error page if not cached
    if (!errorPage) {
        errorPage = 
            (
                await readFile(`${process.cwd()}/dist/error.html`)
                      .catch((err) => console.error(err))
                || "<pre>$code $text</pre>"
            )
            .toString()
    }

    // serve error
    res.statusMessage = reason
    res.status(code)
    res.header("x-backup-status-message", reason) // glitch default nginx configuration
    res.send(
        errorPage
            .replaceAll("$code",code.toString())
            .replaceAll("$text",reason)
    )
}
/**
 * @description Redirects a user to another page.
 * @param res Express response object
 * @param url Target URL
 * @deprecated Use `res.redirect` instead.
 */
export function Redirect(res:Response,url:string) {
    res.status(302)
    res.header("Location",url)
    res.send()
}
