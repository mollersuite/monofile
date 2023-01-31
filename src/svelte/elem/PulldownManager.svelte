<script context="module">
    import { writable } from "svelte/store";
    export const pulldownOpen = writable(0); 
</script>

<script>
    import { onMount } from "svelte";
    import { fade, scale } from "svelte/transition";
    
    export function isOpen() {
        return $pulldownOpen
    }

    export function openPulldown() {
        pulldownOpen.set(true)
    }

    export function closePulldown() {
        pulldownOpen.set(false)
    }

    onMount(() => {
        
    })
</script>
{#if $pulldownOpen}
    <div class="pulldown" transition:fade={{duration:200}}>
        
    </div>

    <button 
        id="overlay" 
        on:click={closePulldown} 
        transition:fade={{duration:200}} 
    />
{/if}