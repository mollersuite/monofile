import crypto from "crypto"
import * as auth from "./auth";
import { readFile, writeFile } from "fs/promises"

// this is probably horrible
// but i don't even care anymore

export let Accounts: Account[] = []

export interface Account {
    id          : string
    username    : string
    password    : {
        hash    : string
        salt    : string
    }
    files       : string[]
    collections : string[]
    admin       : boolean
}

export function create(username:string,pwd:string,admin:boolean=false) {
    let accId = crypto.randomBytes(12).toString("hex")

    Accounts.push(
        {
            id:     accId,
            username: username,
            password: password.hash(pwd),
            files: [],
            collections: [],
            admin: admin
        }
    )

    save()

    return accId
}

export function getFromUsername(username:string) {
    return Accounts.find(e => e.username == username)
}

export function getFromId(id:string) {
    return Accounts.find(e => e.id == id)
}

export function getFromToken(token:string) {
    let accId = auth.validate(token)
    if (!accId) return
    return getFromId(accId)
}

export function deleteAccount(id:string) {
    Accounts.splice(Accounts.findIndex(e => e.id == id),1)
    save()
}

export namespace password {
    export function hash(password:string,_salt?:string) {
        let salt = _salt || crypto.randomBytes(12).toString('base64')
        let hash = crypto.createHash('sha256').update(`${salt}${password}`).digest('hex')

        return {
            salt:salt,
            hash:hash
        }
    }

    export function set(id:string,password:string) {
        let acc = Accounts.find(e => e.id == id)
        if (!acc) return

        acc.password = hash(password)
        save()
    }

    export function check(id:string,password:string) {
        let acc = Accounts.find(e => e.id == id)
        if (!acc) return

        return acc.password.hash == hash(password,acc.password.salt).hash
    }
}

export namespace files {
    export function index(accountId:string,fileId:string) {
        // maybe replace with a obj like
        // { x:true }
        // for faster lookups? not sure if it would be faster
        let acc = Accounts.find(e => e.id == accountId)
        if (!acc) return
        if (acc.files.find(e => e == fileId)) return

        acc.files.push(fileId)
        save()
    }

    export function deindex(accountId:string,fileId:string) {
        let acc = Accounts.find(e => e.id == accountId)
        if (!acc) return
        let fi = acc.files.findIndex(e => e == fileId)
        if (fi) {
            acc.files.splice(fi,1)
            save()
        }
    }
}

export function save() {
    writeFile(`${process.cwd()}/.data/accounts.json`,JSON.stringify(Accounts))
        .catch((err) => console.error(err))
}

readFile(`${process.cwd()}/.data/accounts.json`)
    .then((buf) => {
        Accounts = JSON.parse(buf.toString())
    }).catch(err => console.error(err))
    .finally(() => {
        if (!Accounts.find(e => e.admin)) {
            create("admin","admin",true)
        }
    })