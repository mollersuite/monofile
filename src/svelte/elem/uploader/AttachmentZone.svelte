<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { circOut } from "svelte/easing"
    import { _void } from "../transition/_void"

    enum UploadTypes {
        None,
        Files,
        Clone
    }

    let uploadType: UploadTypes = UploadTypes.None
    let dispatch = createEventDispatcher();

    // file upload
    let files: FileList | undefined
    $: if (files) {
        [...files].forEach(file=>dispatch("addFiles", file))
        uploadType = UploadTypes.None
    }

    // file clone
    let cloneUrlTextbox: HTMLInputElement;
    let cloneForm: HTMLFormElement;

    $: {
        if (cloneForm && cloneUrlTextbox) {
            cloneForm.addEventListener("submit",(e) => {
                e.preventDefault()
                if (cloneUrlTextbox.value) {
                    dispatch("addFiles",cloneUrlTextbox.value)
                    uploadType = UploadTypes.None;
                } else {
                    cloneUrlTextbox.animate([
                        {"transform":"translateX(0px)"},
                        {"transform":"translateX(-3px)"},
                        {"transform":"translateX(3px)"},
                        {"transform":"translateX(0px)"}
                    ],100)
                }
            })
        }
    }
</script>

<!-- there are 100% better ways to do this but idgaf, it's still easier to manage than <1.3 lmao -->

<div id="add_new_files" transition:_void={{duration:200}}>
    <p>
        +<span class="add_files_txt">add files</span>
    </p>
    {#if uploadType == UploadTypes.None}
        <div id="file_add_btns" out:_void in:_void={{easingFunc:circOut}}>
            <button on:click={() => uploadType = UploadTypes.Files} >upload files...</button>
            <button on:click={() => uploadType = UploadTypes.Clone} >clone url...</button>
        </div>
    {:else}
        {#if uploadType == UploadTypes.Files}
            <div id="file_add_btns" out:_void in:_void={{easingFunc:circOut}}>
                <div class="fileUpload">
                    <p>click/tap to browse<br/>or drag files into this box</p>
                    <input type="file" multiple bind:files={files}>
                </div>
            </div>
        {:else if uploadType == UploadTypes.Clone}
            <form id="file_add_btns" out:_void in:_void={{easingFunc:circOut}} bind:this={cloneForm}>
                <input placeholder="url" type="text" bind:this={cloneUrlTextbox}>
                <input type="submit" value="add file" style:flex-basis="30%">
            </form>
        {/if}
    {/if}
</div>