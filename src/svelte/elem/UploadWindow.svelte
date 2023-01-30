<script>
    import { _void } from "./transition/_void.js";
    import { fade } from "svelte/transition";
    import { circIn, circOut } from "svelte/easing";

    import AttachmentZone from "./uploader/AttachmentZone.svelte";

    // stats

    let ServerStats = {}

    let refresh_stats = () => {
        fetch("/server").then(async (data) => {
            ServerStats = await data.json()
        })
    }

    refresh_stats()
    
    // uploads

    let attachmentZone;
    let uploads = {};
    let uploadInProgress = false;

    let handle_file_upload = (ev) => {
        if (ev.detail.type == "clone") {
            uploads[Math.random().toString().slice(2)] = {
                type: "clone",
                name: ev.detail.url,
                url: ev.detail.url,

                params: {
                    uploadId: ""
                },

                uploadStatus:{
                    fileId: null,
                    error: null,
                }
            }

            uploads = uploads
        } else if (ev.detail.type == "upload") {
            ev.detail.files.forEach((v,x) => {
                uploads[Math.random().toString().slice(2)] = {
                    type: "upload",
                    name: v.name,
                    file: v,

                    params: {
                        uploadId: ""
                    },

                    uploadStatus:{
                        fileId: null,
                        error: null,
                    }
                }
            })

            uploads = uploads
        }
    }

    let handle_fetch_promise = (x,prom) => {
        return prom.then(async (res) => {
            let txt = await res.text()
            if (txt.startsWith("[err]")) uploads[x].uploadStatus.error = txt;
            else {
                uploads[x].uploadStatus.fileId = txt;
                
                refresh_stats();
            }
        }).catch((err) => {
            uploads[x].uploadStatus.error = err.toString();
        })
    }

    let upload_files = () => {
        uploadInProgress = true

        // go through all files
        Object.entries(uploads).forEach(([x,v]) => {
            switch(v.type) {
                case "upload":
                    let fd = new FormData()
                    fd.append("file",v.file)

                    handle_fetch_promise(x,fetch("/upload",{
                        headers: {
                            "monofile-params": JSON.stringify(v.params)
                        },
                        method: "POST",
                        body: fd
                    }))
                break
                case "clone":
                    handle_fetch_promise(x,fetch("/clone",{
                        method: "POST",
                        body: JSON.stringify({
                            url: v.url,
                            ...v.params
                        })
                    }))
                break
            }
        })
    }

    // animation

    function padding_scaleY(node, { duration, easingFunc, padY, padX, op }) {
        let rect = node.getBoundingClientRect()

        return {
            duration: duration||300,
            css: t => {
                let eased = (easingFunc || circOut)(t)

                return `
                    height: ${eased*(rect.height-(padY||0))}px;
                    ${padX&&padY ? `padding: ${(eased)*(padY)}px ${(padX)}px;` : ""}
                    ${op ? `opacity: ${eased};` : ""}
                `
            }
        }
    }
    
    function fileTransition(node) {
        return {
            duration: 300,
            css: t => {
                let eased = circOut(t)

                return `
                    height: ${eased*(node.offsetHeight-20)}px;
                    padding: ${eased*10}px 10px;
                `
            }
        }
    }

</script>

<div id="uploadWindow">
    <h1>monofile</h1>
    <p style:color="#999999">
        <span class="number">{ServerStats.version ? `v${ServerStats.version}` : "•••"}</span>&nbsp;&nbsp—&nbsp;&nbsp;Discord based file sharing
    </p>

    <div style:min-height="10px" />
    
    <!-- consider splitting the file thing into a separate element maybe -->

    <div class="uploadContainer">
        {#each Object.entries(uploads) as upload (upload[0])}
            <!-- container to allow for animate directive -->
            <div>
                <div class="file" transition:fileTransition style:border={upload[1].uploadStatus.error ? "1px solid #BB7070" : ""}>
                    <h2>{upload[1].name} <span style:color="#999999" style:font-weight="400">{upload[1].type}{@html upload[1].type == "upload" ? `&nbsp;(${Math.round(upload[1].file.size/1048576)}MB)` : ""}</span></h2>
                    
                    {#if upload[1].maximized && !uploadInProgress}
                        <div transition:padding_scaleY|local>
                            <div style:height="10px" />
                            <input placeholder="custom id" type="text" bind:value={ uploads[upload[0]].params.uploadId }>
                            <div style:height="10px" />
                            <div class="buttonContainer">
                                <button on:click={() => {delete uploads[upload[0]];uploads=uploads;}}>
                                    delete
                                </button>
                                <button on:click={() => uploads[upload[0]].maximized = false}>
                                    minimize
                                </button>
                            </div>
                        </div>
                    {:else if !uploadInProgress}
                        <button on:click={() => uploads[upload[0]].maximized = true} class="hitbox"></button>
                    {:else}
                        <div transition:padding_scaleY|local class="uploadingContainer">
                            {#if !upload[1].uploadStatus.fileId}
                                <p in:fade={{duration:300, delay:400, easingFunc:circOut}} out:padding_scaleY={{easingFunc:circIn,op:true}}>{upload[1].uploadStatus.error ?? "Uploading..."}</p>
                            {/if}

                            {#if upload[1].uploadStatus.fileId}
                                <div style:height="10px" transition:padding_scaleY />
                                {#if !upload[1].viewingUrl}
                                    <div class="buttonContainer" out:_void in:_void={{easingFunc:circOut}}>
                                        <button on:click={() => uploads[upload[0]].viewingUrl = true}>
                                            view url
                                        </button>
                                        <button on:click={() => navigator.clipboard.writeText(`https://${window.location.host}/download/${upload[1].uploadStatus.fileId}`)}>
                                            copy url
                                        </button>
                                    </div>
                                {:else}
                                    <div class="buttonContainer" out:_void in:_void={{easingFunc:circOut}}>
                                        <input type="text" readonly value={`https://${window.location.host}/download/${upload[1].uploadStatus.fileId}`} style:flex-basis="80%">
                                        <button on:click={() => uploads[upload[0]].viewingUrl = false} style:flex-basis="20%">
                                            ok
                                        </button>
                                    </div>
                                {/if}
                            {/if}
                        </div>
                    {/if}
                </div>
                <div style:height="10px" transition:padding_scaleY />
            </div>
        {/each}
    </div>
    
    {#if uploadInProgress == false}
        <AttachmentZone bind:this={attachmentZone} on:addFiles={handle_file_upload}/>
        <div style:min-height="10px" transition:padding_scaleY />
        {#if Object.keys(uploads).length > 0}
            <button in:padding_scaleY={{easingFunc:circOut}} out:_void on:click={upload_files}>upload</button>
            <div transition:_void style:min-height="10px" />
        {/if}
    {/if}
   
    <p style:color="#999999" style:text-align="center">
        Hosting <span class="number" style:font-weight="600">{ServerStats.files || "•••"}</span> files
        —
        Maximum filesize is <span class="number" style:font-weight="600">{((ServerStats.maxDiscordFileSize || 0)*(ServerStats.maxDiscordFiles || 0))/1048576 || "•••"}MB</span>
        <br />
    </p>

    <p style:color="#999999" style:text-align="center" style:font-size="12px">
        Made with {Math.floor(Math.random()*10)==0 ? "🐟" : "❤"} by <a href="https://github.com/nbitzz" style:font-size="12px">@nbitzz</a> — <a href="https://github.com/nbitzz/monofile" style:font-size="12px">source</a>
    </p>
    <div style:height="10px" />
</div>