<script lang="ts">
    import { circOut } from "svelte/easing";
    import { scale } from "svelte/transition";
    import PulldownManager, {pulldownOpen} from "./PulldownManager.svelte";
    import { account } from "./stores.js";
    import { _void } from "./transition/_void.js";

    export let pulldown: PulldownManager;
</script>

<div id="topbar">
    {#if $pulldownOpen} 
        <button 
            class="menuBtn" 
            on:click={pulldown.closePulldown} 
            transition:_void={{duration:200,prop:"width",easingFunc:circOut}}
        >close</button>
    {/if}
    
    <!-- too lazy to make this better -->

    <button class="menuBtn" on:click={() => pulldown.openPulldown("files")}>files</button>
    <button class="menuBtn" on:click={() => pulldown.openPulldown("account")}>{$account?.username ? `@${$account.username}` : "account"}</button>
    <button class="menuBtn" on:click={() => pulldown.openPulldown("help")}>help</button>

    <div /> <!-- not sure what's offcenter but something is
                 so this div is here to ""fix"" that        -->
</div>