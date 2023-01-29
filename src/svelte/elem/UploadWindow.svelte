<script>

    // stats

    let ServerStats = {}

    fetch("/server").then(async (data) => {
        ServerStats = await data.json()
    })
    
</script>

<div id="uploadWindow">
    <h1>monofile</h1>
    <p style:color="#999999">
        <span class="number">{ServerStats.version ? `v${ServerStats.version}` : "•••"}</span>&nbsp;&nbsp—&nbsp;&nbsp;Discord based file sharing
    </p>

    
    
    <p style:color="#999999" style:text-align="center">
        Hosting <span class="number" style:font-weight="600">{ServerStats.files || "•••"}</span> files
    </p>
</div>