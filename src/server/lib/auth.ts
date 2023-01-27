import crypto from "crypto"
import { readFile, writeFile } from "fs/promises"
export let AuthTokens: AuthToken[] = []
export let AuthTokenTO:{[key:string]:NodeJS.Timeout} = {}

export interface AuthToken {
    account: string,
    token: string,
    expire: number
}

export function create(id:string,expire:number=(24*60*60*1000)) {
    let token = {
        account:id,
        token:crypto.randomBytes(12).toString('hex'),
        expire:Date.now()+expire
    }
    
    AuthTokens.push(token)
    tokenTimer(token)

    save()

    return token.token
}

export function validate(token:string) {
    return AuthTokens.find(e => e.token == token && Date.now() < e.expire)?.account
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