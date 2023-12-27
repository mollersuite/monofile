import fs from "fs"
import { stat } from "fs/promises"
import Files from "./lib/files"
import { program } from "commander"
import { basename } from "path"
import { Writable } from "node:stream"
const pkg = require(`${process.cwd()}/package.json`)
let config = require(`${process.cwd()}/config.json`)

// init data

if (!fs.existsSync(__dirname + "/../../.data/"))
    fs.mkdirSync(__dirname + "/../../.data/")

// discord
let files = new Files(config)

program
    .name("monocli")
    .description("Quickly run monofile to execute a query or so")
    .version(pkg.version)

program.command("list")
    .alias("ls")
    .description("List files in the database")
    .action(() => {
        Object.keys(files.files).forEach(e => console.log(e))
    })


program.command("download")
    .alias("dl")
    .description("Download a file from the database")
    .argument("<id>", "ID of the file you'd like to download")
    .option("-o, --output <path>", 'Folder or filename to output to')
    .action(async (id, options) => {

        await (new Promise<void>(resolve => setTimeout(() => resolve(), 1000)))

        let fp = files.files[id]

        if (!fp)
            throw `file ${id} not found`
        
        let out = options.output as string || `./`

        if (fs.existsSync(out) && (await stat(out)).isDirectory())
            out = `${out.replace(/\/+$/, "")}/${fp.filename}`

        ;(await files.readFileStream(id)).pipe(
            fs.createWriteStream(out)
        )
    })


program.command("upload")
    .alias("up")
    .description("Upload a file to the instance")
    .argument("<file>", "Path to the file you'd like to upload")
    .option("-id, --fileid <id>", 'Custom file ID to use')
    .action(async (file, options) => {

        await (new Promise<void>(resolve => setTimeout(() => resolve(), 1000)))

        if (!(fs.existsSync(file) && (await stat(file)).isFile()))
            throw `${file} is not a file`
    
        let writable = files.writeFileStream({
            filename: basename(file),
            mime: "application/octet-stream",
            size: (await stat(file)).size,
            uploadId: options.fileid
        })

        if (!(writable instanceof Writable))
            throw JSON.stringify(writable, null, 3)

        console.log(`started: ${file}`)

        writable.on("drain", () => {
            console.log("Drained")
        })

        writable.on("finish", () => {
            console.log("Finished!")
        })

        writable.on("pipe", () => {
            console.log("Piped")
        })

        writable.on("error", (e) => {
            console.error(e)
        })

        writable.on("close", () => {
            console.log("Closed.")
        })
    

        ;(await fs.createReadStream(file)).pipe(
            writable
        )
    })


program.command("memup")
    .description("Upload a file to the instance (no stream)")
    .argument("<file>", "Path to the file you'd like to upload")
    .option("-id, --fileid <id>", 'Custom file ID to use')
    .action(async (file, options) => {

        await (new Promise<void>(resolve => setTimeout(() => resolve(), 1000)))
        
        if (!(fs.existsSync(file) && (await stat(file)).isFile()))
            throw `${file} is not a file`

        let buf = fs.readFileSync(file)
    
        let id = files.uploadFile({
            filename: basename(file),
            mime: "application/octet-stream",
            uploadId: options.fileid
        }, buf)

        console.log(`uploaded: ${await id}`)

    })


program.parse()