import { writable } from "svelte/store"

export let pulldownManager = writable(0)
export let account = writable({})
export let serverStats = writable({})
export let files = writable([])

export let fetchAccountData = function() {
    fetch("/auth/me").then(async (response) => {
        if (response.status == 200) {
            account.set(await response.json())
        } else {
            account.set({})
        }
    }).catch((err) => { console.error(err) })
}

export let fetchFilePointers = function() {
    fetch("/files/list", { cache: "no-cache" }).then(async (response) => {
        if (response.status == 200) {
            files.set(await response.json())
        } else {
            files.set([])
        }
    }).catch((err) => { console.error(err) })
}

export let refresh_stats = () => {
    fetch("/server").then(async (data) => {
        serverStats.set(await data.json())
    }).catch((err) => { console.error(err) })
}

fetchAccountData()