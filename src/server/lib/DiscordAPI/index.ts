import { REST } from "./DiscordRequests.js"
import type { APIMessage } from "discord-api-types/v10"
import FormData from "form-data"
import { Readable } from "node:stream"
import { Configuration } from "../files.js"

const EXPIRE_AFTER = 20 * 60 * 1000
const DISCORD_EPOCH = 1420070400000
// Converts a snowflake ID string into a JS Date object using the provided epoch (in ms), or Discord's epoch if not provided
function convertSnowflakeToDate(snowflake: string|number, epoch = DISCORD_EPOCH) {
    // Convert snowflake to BigInt to extract timestamp bits
    // https://discord.com/developers/docs/reference#snowflakes
    const milliseconds = BigInt(snowflake) >> 22n
    return new Date(Number(milliseconds) + epoch)
}

interface MessageCacheObject {
	expire: number,
	object: APIMessage
}

export class Client {
	private readonly token         : string
	private readonly rest          : REST
	private readonly targetChannel : string
	private readonly config        : Configuration
	private messageCache           : Map<string, MessageCacheObject> = new Map()

	constructor(token: string, config: Configuration) {
		this.token = token
		this.rest = new REST(token)
		this.targetChannel = config.targetChannel
		this.config = config
	}

	async fetchMessage(id: string, cache: boolean = true) {
		if (cache && this.messageCache.has(id)) {
			let cachedMessage = this.messageCache.get(id)!
			if (cachedMessage.expire >= Date.now()) {
				return cachedMessage.object
			}
		}

		let message = await (this.rest.fetch(`/channels/${this.targetChannel}/messages/${id}`).then(res=>res.json()) as Promise<APIMessage>)

		this.messageCache.set(id, { object: message, expire: EXPIRE_AFTER + Date.now() })
		return message
	}

	async deleteMessage(id: string) {
		await this.rest.fetch(`/channels/${this.targetChannel}/messages/${id}`, {method: "DELETE"})
		this.messageCache.delete(id)
	}

	// https://discord.com/developers/docs/resources/channel#bulk-delete-messages
    // "This endpoint will not delete messages older than 2 weeks" so we need to check each id
    async deleteMessages(ids: string[]) {
        
		// Remove bulk deletable messages

		let bulkDeletable = ids.filter(e => convertSnowflakeToDate(e).valueOf() < 2 * 7 * 24 * 60 * 60 * 1000)
        await this.rest.fetch(`/channels/${this.targetChannel}/messages/bulk-delete`, {method: "POST",body: JSON.stringify({messages: bulkDeletable})})
        bulkDeletable.forEach(Map.prototype.delete.bind(this.messageCache))

		// everything else, we can do manually...
		// there's probably a better way to do this @Jack5079
		// fix for me if possible
		await Promise.all(ids.map(async e => {
			if (convertSnowflakeToDate(e).valueOf() >= 2 * 7 * 24 * 60 * 60 * 1000) {
				return await this.deleteMessage(e)
			}
		}).filter(Boolean)) // filter based on whether or not it's undefined

    }
	
	async send(stream: Readable) {
		
		let bytes_sent = 0
		let file_number = 0
		let boundary = "-".repeat(20) + Math.random().toString().slice(2)

		let pushBoundary = (stream: Readable) => 
			stream.push(`${(file_number++) == 0 ? "" : "\n"}--${boundary}\nContent-Disposition: form-data; name="files[${file_number}]"; filename="${Math.random().toString().slice(2)}\nContent-Type: application/octet-stream\n\n`)
		let boundPush = (stream: Readable, chunk: Buffer) => {
			let position = 0
			console.log(`Chunk length ${chunk.byteLength}`)
			while (position < chunk.byteLength) {
				let capture = Math.min(
					this.config.maxDiscordFileSize - (bytes_sent % this.config.maxDiscordFileSize) + 1, 
					chunk.byteLength
				)
				console.log(`Capturing ${capture} bytes, ${chunk.subarray(position, position+capture).byteLength}`)
				stream.push( chunk.subarray(position, position + capture) )
				position += capture, bytes_sent += capture

				console.log("Chunk progress:", bytes_sent % this.config.maxDiscordFileSize, "B")

				if ((bytes_sent % this.config.maxDiscordFileSize) == 0) {
					console.log("Progress is 0. Pushing boundary")
					pushBoundary(stream)
				}
			}

			
		}

		let transformed = new Readable({
			read() {
				let result = stream.read()
				if (result) boundPush(this, result)
				if (result === null) {
					console.log("Ending")
					this.push(`\n--${boundary}--`)
					this.push(null)
				}
			}
		})
		
		pushBoundary(transformed)

		let returned = await this.rest.fetch(`/channels/${this.targetChannel}/messages`, {
			method: "POST",
			body: transformed,
			headers: {
				"Content-Type": `multipart/form-data; boundary=${boundary}`
			}
		})

		let response = (await returned.json() as APIMessage)
		console.log(JSON.stringify(response, null, 4))
		return response

	}
}