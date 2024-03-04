import { createTransport } from "nodemailer"
import "dotenv/config"
import config from "../../../config.json" assert {type:"json"}

let mailConfig = config.mail,
    transport = createTransport({
        ...mailConfig.transport,
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
        },
    })

// lazy but

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
