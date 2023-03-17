<script>
    import Pulldown from "./Pulldown.svelte"
    import { account, fetchFilePointers, files, pulldownManager } from "../stores.mjs";

    fetchFilePointers();
</script>

<Pulldown name="files">

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
                    <div class="flFile">
                        <h2>{file.filename}</h2>
                        <p class="detail"><span class="number">{file.id}</span>&nbsp;&nbsp;—&nbsp;&nbsp;<span class="number">{file.mime.split(";")[0]}</span></p>
                    </div>
                {/each}
            </div>  
        </div> 
    {/if}

</Pulldown>