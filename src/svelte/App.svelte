<script>
    import { onMount } from "svelte";
    import Topbar from "./elem/Topbar.svelte";
    import PulldownManager from "./elem/PulldownManager.svelte";
    import UploadWindow from "./elem/UploadWindow.svelte";
    
    /** 
     * @type Topbar
     */
    let topbar;

    /**
     * @type PulldownManager
    */
    let pulldownManager;
</script>

<Topbar bind:this={topbar} pulldown={pulldownManager} />
<div id="appContent">
    <PulldownManager bind:this={pulldownManager} />

    <UploadWindow/>
</div>