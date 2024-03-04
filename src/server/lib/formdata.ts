import { Transform, Readable } from "node:stream";
import { TransformCallback } from "stream";

let content_disposition_matcher = /\s*([^=;]+)(?:=(?:"((?:\\"|[^"])*)"|([^;]*))?;?|;?)/g // probably a bad regex but IDC

/**
 * @description Checks if a chunk can be completed by something else (ex. a boundary)
 * @param chunk Chunk to perform check on
 * @param cmp Chunk to check whether or not something is completable with
 * @returns Whether or not this chunk could be completed by cmp
 */
function endChk(chunk: Buffer, cmp: Buffer) {
    for (let i = cmp.byteLength-1; i > 0; i--)
        if (chunk.subarray(-(i-1)).equals(cmp.subarray(0,i))) 
            return true
    return false
}

export type Headers = {
    ["content-disposition"]?: Record<string, boolean|string>,
    ["content-type"]?: string
}

export class Field extends Readable {

    headers: Headers = {}

    constructor(unparsedHeaders: string) {
        super()
        this.headers = Object.fromEntries(
            unparsedHeaders.split("\r\n")
                .map(e => [e.split(":")[0].trim(), e.split(":").slice(1).join(":").trim()])
        )

        if (this.headers["content-disposition"])
            this.headers["content-disposition"] = Object.fromEntries(Array.from(
                (this.headers["content-disposition"] as unknown as string)
                    .matchAll(content_disposition_matcher)).map(e => [e[1], e[2] ? e[2] : true]))
    }

    _read(size: number): void {
        this.emit("hungry")
    }

    collect(maxSize: number = 0) {
        return new Promise<Buffer>((res,rej) => {
            let bufs: Buffer[] = []

            this.on("data", (data) => {
                if (maxSize && bufs.reduce((cur, acc) => cur+acc.byteLength, 0) > maxSize)
                    this.destroy(new Error("went above collect()'s maxSize"))
                bufs.push(data)
            })

            this.on("end", () => res(Buffer.concat(bufs)))
            this.on("error", (err) => rej(err))
        })
    }

}

export default class FormDataParser extends Transform {

    readableObjectMode = true

    readonly boundary: string
    private workingMemory: Buffer | undefined
    private workingField: Field | undefined
    
    constructor(boundary: string) {
        super()
        this.boundary = boundary
    }

    _transform(_chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
        
        let chunk = this.workingMemory ? Buffer.concat([this.workingMemory, _chunk]) : _chunk

    }
    
}