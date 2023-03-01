<script>
    import { fade, slide } from "svelte/transition";


    let activeModal;
    let modalResults;

    /**
     * 
     * @param mdl {name:string,icon:string,description:string,id:string}[]
     * @returns Promise
     */
    export function picker(title,mdl) {
        if (activeModal) forceCancel()

        return new Promise((resolve,reject) => {
            activeModal = {
                resolve,
                title,
                modal:mdl
            }

            modalResults = {

            }
        })
    }

    export function forceCancel() {
        if (activeModal && activeModal.resolve) {
            activeModal.resolve(null)
        }
        activeModal = null
    }
</script>

{#if activeModal}
    <button class="modalContainer" on:click|self={forceCancel} transition:fade={{duration:200}}>
        <div class="modal" transition:slide={{duration:200}}>

            <div class="optPicker">

                <div class="category">
                    <p>{activeModal.title}</p>
                </div>
                
                {#each activeModal.modal as option (option.id)}
                    {#if option.inputSettings}
                        <div class="inp">
                            <img src={option.icon} alt={option.id}>

                            <!-- i have to do this stupidness because of svelte but -->
                            <!-- its reason for blocking this is pretty good sooooo -->

                            {#if option.inputSettings.password}
                                <input placeholder={option.name} type="password" bind:value={modalResults[option.id]}>
                            {:else}
                                <input placeholder={option.name} bind:value={modalResults[option.id]}>
                            {/if}
                        </div>
                    {:else}
                        <button on:click={() => {activeModal.resolve({...modalResults,selected:option.id});activeModal=null;modalResults=null;}}>
                            <img src={option.icon} alt={option.id}>
                            <p>{option.name}<span><br />{option.description}</span></p>
                        </button>
                    {/if}
                {/each}

                <button on:click={forceCancel}>
                    <img src="/static/assets/icons/delete.svg" alt="cancel">
                    <p>Cancel</p>
                </button>

            </div>
        </div>
    </button>
{/if}