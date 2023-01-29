<script>

    // stats

    let ServerStats = {}

    fetch("/server").then(async (data) => {
        ServerStats = await data.json()
    })
    
    // uploads

    let uploads = new Map()

</script>

<div id="uploadWindow">
    <h1>monofile</h1>
    <p style:color="#999999">
        <span class="number">{ServerStats.version ? `v${ServerStats.version}` : "•••"}</span>&nbsp;&nbsp—&nbsp;&nbsp;Discord based file sharing
    </p>

    <div>
        {#each Array.from(uploads.entries()) as upload (upload[0])}
            <div class="Upload">
                
            </div>
        {/each}
    </div>

    <div style:height="10px" />
    
    <div id="add_new_files">
        <p>+<span>add files</span></p>
        <div id="file_add_btns">
            <button>upload file...</button><button>clone url...</button>
        </div>
    </div>

    <div style:height="5px" />
   
    <p style:color="#999999" style:text-align="center">
        Hosting <span class="number" style:font-weight="600">{ServerStats.files || "•••"}</span> files
    </p>
</div>