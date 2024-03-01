import { Hono } from "hono"
import { readFile, readdir } from "fs/promises"
import Files from "../lib/files.js"

const APIDirectory = __dirname + "/api"

interface APIMount {
    file: string
    to: string
}

type APIMountResolvable = string | APIMount

interface APIDefinition {
    name: string
    baseURL: string
    mount: APIMountResolvable[]
}

function resolveMount(mount: APIMountResolvable): APIMount {
    return typeof mount == "string" ? { file: mount, to: "/" + mount } : mount
}

class APIVersion {
    readonly definition: APIDefinition
    readonly apiPath: string
    readonly root: Hono = new Hono()

    constructor(definition: APIDefinition, files: Files) {
        this.definition = definition
        this.apiPath = APIDirectory + "/" + definition.name

        for (let _mount of definition.mount) {
            let mount = resolveMount(_mount)
            // no idea if there's a better way to do this but this is all i can think of
            let route = require(`${this.apiPath}/${mount.file}.js`) as (
                files: Files
            ) => Hono
            this.root.route(mount.to, route(files))
        }
    }
}

export default class APIRouter {
    readonly files: Files
    readonly root: Hono = new Hono()

    constructor(files: Files) {
        this.files = files
    }

    /**
     * @description Mounts an APIDefinition to the APIRouter.
     * @param definition Definition to mount.
     */

    private mount(definition: APIDefinition) {
        console.log(`mounting APIDefinition ${definition.name}`)

        this.root.route(
            definition.baseURL,
            new APIVersion(definition, this.files).root
        )
    }

    async loadAPIMethods() {
        let files = await readdir(APIDirectory)
        for (let version of files) {
            /// temporary (hopefully). need to figure out something else for this
            let def = JSON.parse(
                (
                    await readFile(
                        `${process.cwd()}/src/server/routes/api/${version}/api.json`
                    )
                ).toString()
            ) as APIDefinition
            this.mount(def)
        }
    }
}
