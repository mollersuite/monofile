<script>
    import { circIn, circOut } from "svelte/easing"

    let uploadTypes = {
        files: 1,
        clone: 2
    }

    let uploadType = undefined

    function _void(node, { duration, easingFunc, op }) {
        let rect = node.getBoundingClientRect()

        return {
            duration: duration||300,
            css: t => {
                let eased = (easingFunc || circIn)(t)

                return `
                    white-space: nowrap;
                    height: ${(eased)*(rect.height)}px;
                    padding: 0px;
                    opacity:${eased};
                    overflow: clip;
                `
            }
        }
    }

    // file upload
    let fileUpload;

    $: {
        if (fileUpload) {
            fileUpload.addEventListener("change",() => {
                uploadType = undefined
            })
        }
    }

    // file clone
    /**
     * @type HTMLButtonElement
     */
    let cloneButton;

    /**
     * @type HTMLInputElement
     */
    let cloneUrlTextbox;

    $: {
        if (cloneButton && cloneUrlTextbox) {
            cloneButton.addEventListener("click",() => {
                if (cloneUrlTextbox.value) {
                    uploadType = undefined;
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
    <p>+<span>add files</span></p>
    {#if !uploadType}
        <div id="file_add_btns" out:_void in:_void={{easingFunc:circOut}}>
            <button on:click={() => uploadType = uploadTypes.files} >upload files...</button>
            <button on:click={() => uploadType = uploadTypes.clone} >clone url...</button>
        </div>
    {:else}
        {#if uploadType == uploadTypes.files}
            <div id="file_add_btns" out:_void in:_void={{easingFunc:circOut}}>
                <div class="fileUpload">
                    <p>click/tap to browse<br/>or drag files into this box</p>
                    <input type="file" multiple bind:this={fileUpload}>
                </div>
            </div>
        {:else if uploadType == uploadTypes.clone}
            <div id="file_add_btns" out:_void in:_void={{easingFunc:circOut}}>
                <input placeholder="url" type="text" bind:this={cloneUrlTextbox}>
                <button style:flex-basis="30%" bind:this={cloneButton}>add file</button>
            </div>
        {/if}
    {/if}
</div>