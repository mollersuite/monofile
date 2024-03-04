import { Transform, Duplex } from "node:stream";
import { TransformCallback } from "stream";

let content_disposition_matcher = /\s*([^=;]+)(?:=(?:"((?:\\"|[^"])*)"|([^;]*))?;?|;?)/g // probably a bad regex but IDC

export type Headers = {
    ["content-disposition"]?: (string|{key: string, value: string})[],
    ["content-type"]?: string
}

export class Field extends Duplex {

    headers: Headers = {}

    constructor(unparsedHeaders: string) {
        super()
        this.headers = Object.fromEntries(
            unparsedHeaders.split("\r\n")
                .map(e => [e.split(":")[0].trim(), e.split(":").slice(1).join(":").trim()])
        )

        if (this.headers["content-disposition"])
            this.headers["content-disposition"] = Array.from(
                (this.headers["content-disposition"] as unknown as string)
                    .matchAll(content_disposition_matcher)).map(e => e[2] ? {key: e[1], value: e[2]} : e[1])
    }

}

export default class FormDataParser extends Transform {

    readableObjectMode = true

    boundary: string
    internalBuffer: Buffer | undefined
    
    constructor(boundary: string) {
        super()
        this.boundary = boundary
    }

    _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
        
    }
    
}