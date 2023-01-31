<script>
    import { circOut } from "svelte/easing";
    import { scale } from "svelte/transition";
    import PulldownManager, {pulldownOpen} from "./PulldownManager.svelte";
    import { _void } from "./transition/_void";

    /**
     * @type PulldownManager
     */
    export let pulldown;
</script>

<div id="topbar">
    {#if $pulldownOpen} 
        <button 
            class="menuBtn" 
            on:click={pulldown.closePulldown} 
            transition:_void={{duration:200,prop:"width",easingFunc:circOut}}
        >close</button>
    {/if}
    <button class="menuBtn" on:click={pulldown.openPulldown}>what's new</button>
    <button class="menuBtn">files</button>
    <button class="menuBtn">account</button>

    <div /> <!-- not sure what's offcenter but something is
                 so this div is here to ""fix"" that        -->
</div>