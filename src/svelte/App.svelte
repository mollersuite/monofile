<!--
    I know this code is pretty bad,
    but this is my first time using svelte lol
-->

<script>
    import { onMount } from "svelte";
    import Topbar from "./elem/Topbar.svelte";
    /**
     * @type Topbar
     */
    let topbar;
    
    onMount(() => {
        
    })
</script>

<Topbar bind:this={topbar} />
<div id="appContent">
    
</div>