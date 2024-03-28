<script lang="ts">
    import { _void } from "./transition/_void.js"
    import { padding_scaleY } from "./transition/padding_scaleY.js"
    import { fade } from "svelte/transition"
    import { circIn, circOut } from "svelte/easing"
    import { serverStats, refresh_stats, account } from "./stores.js"
    import bytes from "bytes"

    import AttachmentZone from "./uploader/AttachmentZone.svelte"

    // stats

    refresh_stats()

    // uploads

    interface Upload {
        file: string | File

        params: {
            uploadId?: string
        }

        uploadStatus: {
            fileId?: string,
            error?: string,
        }

        maximized?: boolean,
        viewingUrl?: boolean
    }

    let attachmentZone
    let uploads: Record<string, Upload> = {}
    let uploadInProgress = false
    let notificationPermission =
        globalThis?.Notification?.permission ?? "denied"
    let handle_file_upload = (file: Event & { detail: File|string }) => {

        uploads[Math.random().toString().slice(2)] = {
            file: file.detail,

            params: {
                uploadId: "",
            },

            uploadStatus: {}
        }

        uploads = uploads

    }

    let handle_fetch_promise = (x: string, prom: Promise<Response>) => {
        return prom
            .then(async (res) => {
                let txt = await res.text()
                if (!res.ok) uploads[x].uploadStatus.error = txt
                else {
                    uploads[x].uploadStatus.fileId = txt
                    try {
                        new Notification("Upload complete", {
                            body: `View at ${location.origin}/${uploads[x].uploadStatus.fileId}`,
                            actions: [
                                {
                                    action: "open",
                                    title: "Open",
                                },
                                {
                                    action: "copy",
                                    title: "Copy",
                                },
                            ],
                        }).addEventListener(
                            "notificationclick",
                            (event) => {
                                if ("action" in event && event.action === "open") {
                                    open(
                                        "/download/" +
                                            uploads[x].uploadStatus.fileId
                                    )
                                } else {
                                    navigator.clipboard.writeText(
                                        `${location.origin}/${uploads[x].uploadStatus.fileId}`
                                    )
                                }
                            }
                        )
                    } catch (_) {}
                    refresh_stats()
                }
            })
            .catch((err) => {
                uploads[x].uploadStatus.error = err.toString()
            })
    }

    let upload_files = async () => {
        uploadInProgress = true

        let sequential = localStorage.getItem("sequentialMode") == "true"

        // go through all files
        for (let [x, v] of Object.entries(uploads)) {
            // quick patch-in to allow for a switch to have everything upload sequentially
            // switch will have a proper menu option later, for now i'm lazy so it's just gonna be a Secret
            let hdl = () => {
                let fd = new FormData()
                if (v.params.uploadId) fd.append("uploadId", v.params.uploadId)
                fd.append("file", v.file)

                return handle_fetch_promise(x,fetch("/api/v1/file",{
                    method: "PUT",
                    body: fd
                }))
            }

            if (sequential) await hdl()
            else hdl()
        }
    }

    // animation

    function fileTransition(node: HTMLElement) {
        return {
            duration: 300,
            css: (t: number) => {
                let eased = circOut(t)

                return `
                    height: ${eased * (node.offsetHeight - 22)}px;
                    padding: ${eased * 10}px 10px;
                `
            },
        }
    }
</script>

<div id="uploadWindow">
    <h1>
        monofile
        {#if notificationPermission === "default"}
            <button
                on:click={() => {
                    Notification.requestPermission().then(
                        (permission) => (notificationPermission = permission)
                    )
                }}
                style="float:right"
                title="Notify me when the upload finishes"
            >
                <svg
                    width="20"
                    height="20"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label="Notify me when the upload finishes"
                    ><path
                        d="M9.042 19.003h5.916a3 3 0 0 1-5.916 0Zm2.958-17a7.5 7.5 0 0 1 7.5 7.5v4l1.418 3.16A.95.95 0 0 1 20.052 18h-16.1a.95.95 0 0 1-.867-1.338l1.415-3.16V9.49l.005-.25A7.5 7.5 0 0 1 12 2.004Z"
                        fill="currentColor"
                    /></svg
                >
            </button>
        {/if}
    </h1>
    <p style:color="#999999">
        <span class="number"
            >{$serverStats?.version ? `v${$serverStats?.version}` : "•••"}</span
        >&nbsp;&nbsp;—&nbsp;&nbsp;Discord based file sharing
    </p>

    <div style:min-height="10px" />

    <!-- consider splitting the file thing into a separate element maybe -->

    <div class="uploadContainer">
        {#each Object.entries(uploads) as upload (upload[0])}
            <!-- container to allow for animate directive -->
            <div>
                <div
                    class="file"
                    transition:fileTransition
                    style:border={upload[1].uploadStatus.error
                        ? "1px solid #BB7070"
                        : ""}
                >
                    <h2>
                        {typeof upload[1].file == "string" ? upload[1].file : upload[1].file.name}
                        <span style:color="#999999" style:font-weight="400"
                            >{@html typeof upload[1].file == "string" ? "clone" : `upload&nbsp;(${bytes(upload[1].file.size)})`}</span>
                    </h2>

                    {#if upload[1].maximized && !uploadInProgress}
                        <div transition:padding_scaleY|local>
                            <div style:height="10px" />
                            <input
                                placeholder="custom id"
                                type="text"
                                bind:value={uploads[upload[0]].params.uploadId}
                            />
                            <div style:height="10px" />
                            <div class="buttonContainer">
                                <button
                                    on:click={() => {
                                        delete uploads[upload[0]]
                                        uploads = uploads
                                    }}
                                >
                                    delete
                                </button>
                                <button
                                    on:click={() =>
                                        (uploads[upload[0]].maximized = false)}
                                >
                                    minimize
                                </button>
                            </div>
                        </div>
                    {:else if !uploadInProgress}
                        <button
                            on:click={() =>
                                (uploads[upload[0]].maximized = true)}
                            class="hitbox"
                        />
                    {:else}
                        <div
                            transition:padding_scaleY|local
                            class="uploadingContainer"
                        >
                            {#if !upload[1].uploadStatus.fileId}
                                <p
                                    in:fade={{
                                        duration: 300,
                                        delay: 400,
                                        easingFunc: circOut,
                                    }}
                                    out:padding_scaleY={{
                                        easingFunc: circIn,
                                        op: true,
                                    }}
                                >
                                    {upload[1].uploadStatus.error ??
                                        "Uploading..."}
                                </p>
                            {/if}

                            {#if upload[1].uploadStatus.fileId}
                                <div
                                    style:height="10px"
                                    transition:padding_scaleY
                                />
                                {#if !upload[1].viewingUrl}
                                    <div
                                        class="buttonContainer"
                                        out:_void
                                        in:_void={{ easingFunc: circOut }}
                                    >
                                        <button
                                            on:click={() =>
                                                (uploads[
                                                    upload[0]
                                                ].viewingUrl = true)}
                                        >
                                            view url
                                        </button>
                                        <button
                                            on:click={() =>
                                                navigator.clipboard.writeText(
                                                    `https://${window.location.host}/download/${upload[1].uploadStatus.fileId}`
                                                )}
                                        >
                                            copy url
                                        </button>
                                    </div>
                                {:else}
                                    <div
                                        class="buttonContainer"
                                        out:_void
                                        in:_void={{ easingFunc: circOut }}
                                    >
                                        <input
                                            type="text"
                                            readonly
                                            value={`https://${window.location.host}/download/${upload[1].uploadStatus.fileId}`}
                                            style:flex-basis="80%"
                                        />
                                        <button
                                            on:click={() =>
                                                (uploads[
                                                    upload[0]
                                                ].viewingUrl = false)}
                                            style:flex-basis="20%"
                                        >
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
        <!-- if required for upload, check if logged in -->
        {#if $serverStats?.accounts?.requiredForUpload ? !!$account?.username : true}
            <AttachmentZone
                bind:this={attachmentZone}
                on:addFiles={handle_file_upload}
            />
            <div
                style:min-height="10px"
                transition:_void={{ rTarg: "height", prop: "min-height" }}
            />
            {#if Object.keys(uploads).length > 0}
                <button
                    in:padding_scaleY={{ easingFunc: circOut }}
                    out:_void
                    on:click={upload_files}>upload</button
                >
                <div
                    transition:_void={{ rTarg: "height", prop: "min-height" }}
                    style:min-height="10px"
                />
            {/if}
        {:else}
            <p transition:_void style:color="#999999" style:text-align="center">
                Please log in to upload files.
            </p>
            <div
                transition:_void={{ rTarg: "height", prop: "min-height" }}
                style:min-height="10px"
            />
        {/if}
    {/if}

    <p style:color="#999999" style:text-align="center">
        Hosting <span class="number" style:font-weight="600"
            >{$serverStats?.files ?? "•••"}</span
        >
        files — Maximum filesize is
        <span class="number" style:font-weight="600">
            {
                $serverStats?.maxDiscordFiles
                ? bytes($serverStats.maxDiscordFileSize * $serverStats.maxDiscordFiles)
                :  "•••"
            }</span>
        <br />
    </p>
    <p style:color="#999999" style:text-align="center" style:font-size="12px">
        Made with {Math.floor(Math.random() * 10) == 0 ? "🐟" : "❤"} by
        <a href="https://cetera.uk" style:font-size="12px"
            ><svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 173.8 275.72"
                height="16"
                style="vertical-align:middle"
                fill="currentColor"
            >
                <circle cx="37.13" cy="26.43" r="21.6" />
                <circle cx="34.62" cy="117.87" r="34.62" class="middle" />
                <circle cx="119.78" cy="130.68" r="21.6" class="middle" />
                <circle cx="127.16" cy="46.64" r="46.65" />
                <circle cx="102.68" cy="219.58" r="56.14" class="bottom" />
            </svg> Etcetera</a
        >
        —
        <a href="https://github.com/mollersuite/monofile" style:font-size="12px"
            >source</a
        >
    </p>
    <div style:height="10px" />
</div>
