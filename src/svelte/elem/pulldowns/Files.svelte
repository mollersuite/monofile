<script>
    import Pulldown from "./Pulldown.svelte";
    import { account, fetchFilePointers, files, pulldownManager } from "../stores.mjs";

    import { fade } from "svelte/transition";
    import { flip } from "svelte/animate";
    import { fileOptions } from "../prompts/uploads";
    import OptionPicker from "../prompts/OptionPicker.svelte";

    let picker;

    fetchFilePointers();
</script>

<Pulldown name="files">

    <OptionPicker bind:this={picker} />

    {#if !$account.username}
        <div class="notLoggedIn">
            <div style:height="10px" />
            <p class="flavor">Log in to view uploads</p>
            <button on:click={$pulldownManager.openPulldown("account")}>OK</button>
            <div style:height="14px" />
        </div>
    {:else}
        <div class="loggedIn">
            <input type="text" placeholder={`Search ${$files.length} file(s)`} class="searchBar">

            <div class="fileList">
                {#each $files as file (file.id)}
                    <div class="flFile" transition:fade={{duration:200}} animate:flip={{duration:200}}>
                        <button class="hitbox" on:click={window.open(`/download/${file.id}`)}></button> <!-- this is bad, but I'm lazy -->
                        <div class="flexCont">
                            <div class="fileInfo">
                                <h2>{file.filename}</h2>
                                <p class="detail">
                                    <img src="/static/assets/icons/{file.visibility || "public"}.svg" alt={file.visibility||"public"} />&nbsp;
                                    <span class="number">{file.id}</span>&nbsp;&nbsp;—&nbsp;&nbsp;<span class="number">{file.mime.split(";")[0]}</span>
                                    {#if file.reserved}
                                        <br />
                                        <img src="/static/assets/icons/update.svg" alt="uploading"/>&nbsp;
                                        This file is currently being uploaded. Please wait.
                                    {/if}
                                    {#if file.tag}
                                        <br />
                                        <img src="/static/assets/icons/tag.svg" alt="tag"/>&nbsp;
                                        <span class="number">{file.tag}</span>
                                    {/if}
                                </p>
                            </div>
                            <button class="more" on:click={fileOptions(picker, file)}>
                                <img src="/static/assets/icons/more.svg" alt="more" />
                            </button>
                        </div>
                    </div>
                {/each}
            </div>  
        </div> 
    {/if}

</Pulldown>