import crypto from "crypto"
import express from "express"
import { readFile, writeFile } from "fs/promises"
export let AuthTokens: AuthToken[] = []
export let AuthTokenTO:{[key:string]:NodeJS.Timeout} = {}

export const ValidTokenPermissions = [
    "user",      // permissions to /auth/me, with email docked
    "email",     // adds email back to /auth/me
    "private",   // allows app to read private files
    "upload",    // allows an app to upload under an account
    "manage",    // allows an app to manage an account's files
    "customize", // allows an app to change customization settings
    "admin"      // only available for accounts with admin
                 // gives an app access to all admin tools
] as const

export type TokenType = "User" | "App"
export type TokenPermission = typeof ValidTokenPermissions[number]

export interface AuthToken {
    account: string,
    token: string,
    expire: number,

    type?: TokenType, // if !type, assume User
    tokenPermissions?: TokenPermission[] // default to user if type is App,
                                        // give full permissions if type is User
}

export function create(
    id:string, 
    expire:number=(24*60*60*1000), 
    type:TokenType="User", 
    tokenPermissions?:TokenPermission[]
) {
    let token = {
        account:id,
        token:crypto.randomBytes(36).toString('hex'),
        expire:Date.now()+expire,

        type,
        tokenPermissions: type == "App" ? tokenPermissions || ["user"] : undefined
    }
    
    AuthTokens.push(token)
    tokenTimer(token)

    save()

    return token.token
}

export function tokenFor(req: express.Request) {
    return req.cookies.auth || (
        req.header("authorization")?.startsWith("Bearer ")
        ? req.header("authorization")?.split(" ")[1]
        : undefined
    )
}

export function validate(token:string) {
    return AuthTokens.find(e => e.token == token && Date.now() < e.expire)?.account
}

export function getType(token:string): TokenType | undefined {
    return AuthTokens.find(e => e.token == token && Date.now() < e.expire)?.type
}

export function getPermissions(token:string): TokenPermission[] | undefined {
    return AuthTokens.find(e => e.token == token && Date.now() < e.expire)?.tokenPermissions
}

export function tokenTimer(token:AuthToken) {
    if (Date.now() >= token.expire) {
        invalidate(token.token)
        return
    }

    AuthTokenTO[token.token] = setTimeout(() => invalidate(token.token),token.expire-Date.now())
}

export function invalidate(token:string) {
    if (AuthTokenTO[token]) {
        clearTimeout(AuthTokenTO[token])
    }

    AuthTokens.splice(AuthTokens.findIndex(e => e.token == token),1)
    save()
}

export function save() {
    writeFile(`${process.cwd()}/.data/tokens.json`,JSON.stringify(AuthTokens))
        .catch((err) => console.error(err))
}

readFile(`${process.cwd()}/.data/tokens.json`)
    .then((buf) => {
        AuthTokens = JSON.parse(buf.toString())
        AuthTokens.forEach(e => tokenTimer(e))
    }).catch(err => console.error(err))