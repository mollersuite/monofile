<script>

    // stats

    import AttachmentZone from "./uploader/AttachmentZone.svelte";

    let ServerStats = {}

    fetch("/server").then(async (data) => {
        ServerStats = await data.json()
    })
    
    // uploads

    let attachmentZone;
    let uploads = new Map()

</script>

<div id="uploadWindow">
    <h1>monofile</h1>
    <p style:color="#999999">
        <span class="number">{ServerStats.version ? `v${ServerStats.version}` : "•••"}</span>&nbsp;&nbsp—&nbsp;&nbsp;Discord based file sharing
    </p>

    <div>
        {#each Array.from(uploads.entries()) as upload (upload[0])}
            <div class="file">
                
            </div>
        {/each}
    </div>

    <div style:height="10px" />
    
    {#if uploads.size < 1}
        <AttachmentZone bind:this={attachmentZone}/>
    {/if}

    <div style:height="10px" />
   
    <p style:color="#999999" style:text-align="center">
        Hosting <span class="number" style:font-weight="600">{ServerStats.files || "•••"}</span> files
        —
        Maximum filesize is <span class="number" style:font-weight="600">{((ServerStats.maxDiscordFileSize || 0)*(ServerStats.maxDiscordFiles || 0))/1048576 || "•••"}MB</span>
        <br />
    </p>

    <p style:color="#999999" style:text-align="center" style:font-size="12px">
        Made with ❤ by <a href="https://github.com/nbitzz" style:font-size="12px">@nbitzz</a> — <a href="https://github.com/nbitzz/monofile" style:font-size="12px">source</a>
    </p>
    <div style:height="10px" />
</div>