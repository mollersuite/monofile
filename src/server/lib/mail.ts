import { createTransport } from "nodemailer"
import "dotenv/config"
import config from "../../../config.json" assert {type:"json"}
import { generateFileId } from "./files.js"

let mailConfig = config.mail,
    transport = createTransport({
        ...mailConfig.transport,
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
        },
    })

/**
 * @description Sends an email
 * @param to Target email address
 * @param subject Email subject
 * @param content Email content
 * @returns Promise which resolves to the output from nodemailer.transport.sendMail
 */
export function sendMail(to: string, subject: string, content: string) {
    return transport.sendMail({
        to,
        subject,
        from: mailConfig.send.from,
        html: `<span style="font-size:x-large;font-weight:600;">monofile <span style="opacity:0.5">accounts</span></span><br><span style="opacity:0.5">Gain control of your uploads.</span><hr><br>${content
            .replaceAll(
                "<span username>",
                `<span code><span style="color:#DDAA66;padding-right:3px;">@</span>`
            )
            .replaceAll(
                "<span code>",
                `<span style="font-family:monospace;padding:3px 5px 3px 5px;border-radius:8px;background-color:#1C1C1C;color:#DDDDDD;">`
            )}<br><br><span style="opacity:0.5">If you do not believe that you are the intended recipient of this email, please disregard this message.</span>`,
    })
}

export namespace CodeMgr {

    export const Intents = [
        "verifyEmail",
        "recoverAccount"
    ] as const

    export type Intent = typeof Intents[number]

    export function isIntent(intent: string): intent is Intent { return intent in Intents } 

    export let codes = Object.fromEntries(
        Intents.map(e => [
            e, 
            {byId: new Map<string, Code>(), byUser: new Map<string, Code[]>()}
        ])) as Record<Intent, { byId: Map<string, Code>, byUser: Map<string, Code[]> }>

    // this is stupid whyd i write this

    export class Code { 
        readonly id: string = generateFileId(12)
        readonly for: string

        readonly intent: Intent

        readonly expiryClear: NodeJS.Timeout

        readonly data: any

        constructor(intent: Intent, forUser: string, data?: any, time: number = 15*60*1000) {
            this.for = forUser;
            this.intent = intent
            this.expiryClear = setTimeout(this.terminate.bind(this), time)
            this.data = data

            codes[intent].byId.set(this.id, this);

            let byUser = codes[intent].byUser.get(this.for)
            if (!byUser) {
                byUser = []
                codes[intent].byUser.set(this.for, byUser);
            }

            byUser.push(this)
        }

        terminate() {
            codes[this.intent].byId.delete(this.id);
            let bu = codes[this.intent].byUser.get(this.id)!
            bu.splice(bu.indexOf(this), 1)
            clearTimeout(this.expiryClear)
        }

        check(forUser: string) {
            return forUser === this.for
        }
    }

}