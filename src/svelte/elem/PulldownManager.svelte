<script context="module">
    import { writable } from "svelte/store";
    import { allPulldowns } from "./pulldowns/Pulldown.svelte";

    export const pulldownOpen = writable(false); 
</script>

<script>
    import { onMount } from "svelte";
    import { fade, scale } from "svelte/transition";
    
    export function isOpen() {
        return $pulldownOpen
    }

    export function openPulldown(name) {
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
        <!-- I'm not sure how I could do this any better, so... yeah -->


    </div>

    <button 
        id="overlay" 
        on:click={closePulldown} 
        transition:fade={{duration:200}} 
    />
{/if}