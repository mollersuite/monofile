import { REST } from "./DiscordRequests"
import type { APIMessage } from "discord-api-types/v10"

const EXPIRE_AFTER = 20 * 60 * 1000

interface MessageCacheObject {
	expire: number,
	object: APIMessage
}

export class Client {
	private readonly token         : string
	private readonly rest          : REST
	private readonly targetChannel : string
	private messageCache           : Map<string, MessageCacheObject> = new Map()

	constructor(token: string, targetChannel: string) {
		this.token = token
		this.rest = new REST(token)
		this.targetChannel = targetChannel
	}

	fetchMessage(id: string, cache: boolean = true) {
		if (cache && this.messageCache.has(id)) {
			let cachedMessage = this.messageCache.get(id)!
			if (cachedMessage.expire >= Date.now()) {
				return cachedMessage.object
			}
		}
	}
}