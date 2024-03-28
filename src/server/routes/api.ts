import { Hono } from "hono"
import { readFile, readdir } from "fs/promises"
import Files from "../lib/files.js"
import {fileURLToPath} from "url"
import {dirname} from "path"

const APIDirectory = dirname(fileURLToPath(import.meta.url)) + "/api"

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
    readonly apiRoot: Hono
    readonly root: Hono = new Hono()
    readonly files: Files

    constructor(definition: APIDefinition, files: Files, apiRoot: Hono) {
        this.definition = definition
        this.apiPath = APIDirectory + "/" + definition.name
        this.files = files
        this.apiRoot = apiRoot
    }

    async load() {
        for (let _mount of this.definition.mount) {
            let mount = resolveMount(_mount);
            // no idea if there's a better way to do this but this is all i can think of
            let { default: route } = await import(`${this.apiPath}/${mount.file}.js`) as { default: (files: Files, apiRoot: Hono) => Hono }
            
            this.root.route(mount.to, route(this.files, this.apiRoot))
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

    private async mount(definition: APIDefinition) {
        console.log(`mounting APIDefinition ${definition.name}`)

        let def = new APIVersion(definition, this.files, this.root)
        await def.load()

        this.root.route(
            definition.baseURL,
            def.root
        )
    }

    async loadAPIMethods() {
        let files = await readdir(APIDirectory)
        for (let version of files) {
            let def = JSON.parse(
                (
                    await readFile(
                        `${process.cwd()}/src/server/routes/api/${version}/api.json`
                    )
                ).toString()
            ) as APIDefinition
            await this.mount(def)
        }
    }
}
