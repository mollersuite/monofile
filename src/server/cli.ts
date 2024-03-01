import fs from "fs"
import { stat } from "fs/promises"
import Files from "./lib/files.js"
import { program } from "commander"
import { basename } from "path"
import { Writable } from "node:stream"
import pkg from "../../package.json" assert { type: "json" }
import config from "../../config.json" assert { type: "json" }
import { fileURLToPath } from "url"
import { dirname } from "path"

// init data

const __dirname = dirname(fileURLToPath(import.meta.url))
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
    
        let writable = files.createWriteStream()

        writable
            .setName(file)
            ?.setType("application/octet-stream")
            ?.setUploadId(options.fileId)

        if (!(writable instanceof Writable))
            throw JSON.stringify(writable, null, 3)

        console.log(`started: ${file}`)

        writable.on("drain", () => {
            console.log("Drained");
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
        });

        ;(await fs.createReadStream(file)).pipe(
            writable
        )
    })

program.parse()