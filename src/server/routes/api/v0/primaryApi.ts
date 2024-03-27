import { Hono } from "hono"
import * as Accounts from "../../../lib/accounts.js"
import * as auth from "../../../lib/auth.js"
import RangeParser, { type Range } from "range-parser"
import ServeError from "../../../lib/errors.js"
import Files, { WebError } from "../../../lib/files.js"
import { getAccount, requiresPermissions } from "../../../lib/middleware.js"
import {Readable} from "node:stream"
import type {ReadableStream as StreamWebReadable} from "node:stream/web"
import formidable from "formidable"
import { HttpBindings } from "@hono/node-server"
import pkg from "../../../../../package.json" assert {type: "json"}
import { type StatusCode } from "hono/utils/http-status"
export let primaryApi = new Hono<{
    Variables: {
        account: Accounts.Account
    },
    Bindings: HttpBindings
}>()

primaryApi.all("*", getAccount)

export default function (files: Files, apiRoot: Hono) {
    primaryApi.get("/file/:fileId", async (ctx) => 
        apiRoot.fetch(
            new Request(
                (new URL(
                    `/api/v1/file/${ctx.req.param("fileId")}`, ctx.req.raw.url)).href, 
                    ctx.req.raw
            ), 
            ctx.env
        )
    )

    primaryApi.post("/upload", async (ctx) => 
        apiRoot.fetch(
            new Request(
                (new URL(
                    `/api/v1/file`, ctx.req.raw.url)).href, 
                    {
                        ...ctx.req.raw,
                        method: "PUT"
                    }
            ), 
            ctx.env
        )
    )
    
    return primaryApi
}
