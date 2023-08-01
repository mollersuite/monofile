<script>
    import Pulldown from "./Pulldown.svelte";
    import { account, fetchFilePointers, files, pulldownManager } from "../stores.mjs";

    import { fade } from "svelte/transition";
    import { flip } from "svelte/animate";
    import { fileOptions } from "../prompts/uploads";
    import OptionPicker from "../prompts/OptionPicker.svelte";

    let picker;
    let query = "";

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
            <input type="text" placeholder={`Search ${$files.length} file(s)`} class="searchBar" bind:value={query}>

            <div class="fileList">
                <!-- Probably wildly inefficient but who cares, I just wanna get this over with -->
                {#each $files.filter(f => f.name.toLowerCase().includes(query.toLowerCase()) || f.id.toLowerCase().includes(query.toLowerCase()) || f.tag.includes(query.toLowerCase())) as file (file.id)}
                    <div class="flFile" transition:fade={{duration:200}} animate:flip={{duration:200}}>
                        <button class="hitbox" on:click={window.open(`/download/${file.id}`)}></button> <!-- this is bad, but I'm lazy -->
                        <div class="flexCont">
                            <div class="fileInfo">
                                <h2>{file.filename}</h2>
                                <p class="detail">
                                    <img src="/static/assets/icons/{file.visibility || "public"}.svg" alt={file.visibility||"public"} />&nbsp;
                                    <span class="number">{file.id}</span>&nbsp;&nbsp;—&nbsp;&nbsp;<span class="cd">{file.mime.split(";")[0]}</span>
                                    {#if file.reserved}
                                        <br />
                                        <img src="/static/assets/icons/update.svg" alt="uploading"/>&nbsp;
                                        Uploading...
                                    {/if}
                                    {#if file.tag}
                                        <br />
                                        <img src="/static/assets/icons/tag.svg" alt="tag"/>&nbsp;
                                        <span class="cd">{file.tag}</span>
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