<script context="module" lang="ts">
    import { writable } from "svelte/store";

    // can't find a better way to do this
    import Files from "./pulldowns/Files.svelte";
    import Accounts from "./pulldowns/Accounts.svelte";
    import Help from "./pulldowns/Help.svelte";

    export let allPulldowns = new Map()

    allPulldowns
        .set("account",Accounts)
        .set("help",Help)
        .set("files",Files)

    export const pulldownOpen = writable<string|false>(false); 
</script>

<script lang="ts">
    import { onMount } from "svelte";
    import { fade, scale } from "svelte/transition";

    export function isOpen() {
        return $pulldownOpen
    }

    export function openPulldown(name: string) {
        pulldownOpen.set(name)
    }

    export function closePulldown() {
        pulldownOpen.set(false)
    }

    onMount(() => {
        
    })
</script>
{#if $pulldownOpen}
    <div class="pulldown" transition:fade={{duration:200}}>
        <svelte:component this={allPulldowns.get($pulldownOpen)} />
    </div>

    <button 
        id="overlay" 
        on:click={closePulldown} 
        transition:fade={{duration:200}} 
    />
{/if}