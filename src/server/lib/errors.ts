import { Response } from "express";
import { readFile } from "fs/promises"

let errorPage:string

export default async function ServeError(
    res:Response,
    code:number,
    reason:string
) {
    // fetch error page if not cached
    if (!errorPage) {
        errorPage = 
            (
                await readFile(`${process.cwd()}/pages/error.html`)
                      .catch((err) => console.error(err))
                || "<pre>$code $text</pre>"
            )
            .toString()
    }

    // serve error
    res.status(code)
    res.send(
        errorPage
            .replace(/\$code/g,code.toString())
            .replace(/\$text/g,reason)
    )
}

export function Redirect(res:Response,url:string) {
    res.status(302)
    res.header("Location",url)
    res.send()
}