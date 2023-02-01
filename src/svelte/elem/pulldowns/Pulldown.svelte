<script context="module">
    import { writable } from "svelte/store";

    export const allPulldowns = writable(new Map());
</script>
<script>
    import { pulldownOpen } from "../PulldownManager.svelte";

    export let name;

    allPulldowns
        .set(name,this)
</script>

<div 
    class="pulldown_display" 
    style:display={$pulldownOpen == name ? "block" : "none"}
>
    <slot />
</div>