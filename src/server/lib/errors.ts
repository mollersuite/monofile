import { readFile } from "fs/promises"
import type { Context } from "hono"

let errorPage: string

/**
 * @description Serves an error as a response to a request with an error page attached
 * @param ctx Express response object
 * @param code Error code
 * @param reason Error reason
 */
export default async function ServeError(
    ctx: Context,
    code: number,
    reason: string
) {
    // fetch error page if not cached
    errorPage ??= (
            (await readFile(`${process.cwd()}/dist/error.html`).catch((err) =>
                console.error(err)
            )) ?? "<pre>$code $text</pre>"
    ).toString()
    

    // serve error
    return ctx.html(
        errorPage
            .replaceAll("$code", code.toString())
            .replaceAll("$text", reason),
        code,
        {
            "x-backup-status-message": reason, // glitch default nginx configuration
        }
    )
}
