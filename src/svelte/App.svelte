<script>
    import { onMount } from "svelte";
    import Topbar from "./elem/Topbar.svelte";
    
    /**
     * @type Topbar
     */
    let topbar;
    
    /**
     * @type HTMLButtonElement
    */
    let overlay;

    onMount(() => {
        overlay.addEventListener("click", () => {
            overlay.style.display = ""
        })
    })
</script>

<Topbar bind:this={topbar} />
<div id="appContent">
    <button id="overlay" bind:this={overlay} />
    <div class="pulldown">
        
    </div>
</div>