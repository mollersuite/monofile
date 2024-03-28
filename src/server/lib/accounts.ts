import crypto from "crypto"
import * as auth from "./auth.js";
import { readFile, writeFile } from "fs/promises"
import { FileVisibility } from "./files.js";

// this is probably horrible
// but i don't even care anymore

export let Accounts: Account[] = []

export interface Account {
    id                    : string
    username              : string
    email?                : string
    password              : {
        hash              : string
        salt              : string
    }
    files                 : string[]
    admin                 : boolean
    defaultFileVisibility : FileVisibility
    customCSS?            : string

    embed?                : {
        color?            : string
        largeImage?       : boolean
    }
}

/**
 * @description Create a new account.
 * @param username New account's username
 * @param pwd New account's password
 * @param admin Whether or not the account should have administrative rights
 * @returns A Promise which returns the new account's ID
 */

export async function create(username:string,pwd:string,admin:boolean=false):Promise<string> {
    let accId = crypto.randomBytes(12).toString("hex")

    Accounts.push(
        {
            id:     accId,
            username: username,
            password: password.hash(pwd),
            files: [],
            admin: admin,
            defaultFileVisibility: "public"
        }
    )

    await save()
    return accId
}

/**
 * @description Gets an account from its username.
 * @param id The target account's username
 * @returns An Account, if it exists
 */
export function getFromUsername(username:string) {
    return Accounts.find(e => e.username == username)
}

/**
 * @description Gets an account from its ID.
 * @param id The target account's ID
 * @returns An Account, if it exists
 */
export function getFromId(id:string) {
    return Accounts.find(e => e.id == id)
}

/**
 * @description Gets an account from an AuthToken. Equivalent to getFromId(auth.validate(token)).
 * @param token A valid AuthToken
 * @returns An Account, if the token is valid
 */
export function getFromToken(token:string) {
    let accId = auth.validate(token)
    if (!accId) return
    return getFromId(accId)
}

/**
 * @description Deletes an account.
 * @param id The target account's ID
 */
export function deleteAccount(id:string) {
    Accounts.splice(Accounts.findIndex(e => e.id == id),1)
    return save()
}

export namespace password {
    
    /**
     * @description Generates a hashed and salted version of an input password.
     * @param password Target password.
     * @param _salt Designated password salt. Use to validate a password.
     */

    export function hash(password:string,_salt?:string) {
        let salt = _salt || crypto.randomBytes(12).toString('base64')
        let hash = crypto.createHash('sha256').update(`${salt}${password}`).digest('hex')

        return {
            salt:salt,
            hash:hash
        }
    }
        
    /**
     * @description Sets an account's password.
     * @param id The target account's ID
     * @param password New password
     */

    export function set(id:string,password:string) {
        let acc = Accounts.find(e => e.id == id)
        if (!acc) return

        acc.password = hash(password)
        return save()
    }

        
    /**
     * @description Tests a password against an account.
     * @param id The target account's ID
     * @param password Password to check
     */
    export function check(id:string,password:string) {
        let acc = Accounts.find(e => e.id == id)
        if (!acc) return

        return acc.password.hash == hash(password,acc.password.salt).hash
    }
}

export namespace files {
    /**
     * @description Adds a file to an account's file index
     * @param accountId The target account's ID
     * @param fileId The target file's ID
     * @returns Promise that resolves after accounts.json finishes writing
     */
    export function index(accountId:string,fileId:string) {
        // maybe replace with a obj like
        // { x:true }
        // for faster lookups? not sure if it would be faster
        let acc = Accounts.find(e => e.id == accountId)
        if (!acc) return
        if (acc.files.find(e => e == fileId)) return

        acc.files.push(fileId)
        return save()
    }

    /**
     * @description Removes a file from an account's file index
     * @param accountId The target account's ID
     * @param fileId The target file's ID
     * @param noWrite Whether or not accounts.json should save
     * @returns A Promise which resolves when accounts.json finishes writing, if `noWrite` is `false`
     */
    export function deindex(accountId:string,fileId:string, noWrite:boolean=false) {
        let acc = Accounts.find(e => e.id == accountId)
        if (!acc) return
        let fi = acc.files.findIndex(e => e == fileId)
        if (fi >= 0) {
            acc.files.splice(fi,1)
            if (!noWrite) return save()
        }
    }
}

/**
 * @description Saves accounts.json
 * @returns A promise which resolves when accounts.json finishes writing
 */
export function save() {
    return writeFile(`${process.cwd()}/.data/accounts.json`,JSON.stringify(Accounts))
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