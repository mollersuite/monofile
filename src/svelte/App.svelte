<script>
    import { onMount } from "svelte";
    import Topbar from "./elem/Topbar.svelte";
    import PulldownManager from "./elem/PulldownManager.svelte";
    import UploadWindow from "./elem/UploadWindow.svelte";
    import { pulldownManager } from "./elem/stores.mjs";
    
    /** 
     * @type Topbar
     */
    let topbar;

    /**
     * @type PulldownManager
    */
    let pulldown;

    onMount(() => {
        pulldownManager.set(pulldown)
    })
</script>

<Topbar bind:this={topbar} pulldown={pulldown} />
<div id="appContent">
    <PulldownManager bind:this={pulldown} />

    <UploadWindow/>
</div>