<script lang="ts">
    import { fade, slide } from "svelte/transition";

    interface BaseModalOption {
        name:string,
        icon:string,
        id: string | number | symbol | boolean
    }

    type ModalOption = BaseModalOption & {inputSettings: {password?: boolean}, id: any} | BaseModalOption & { description: string }

    type ModalOptions = ModalOption[]
    type OptionPickerReturns =  {selected: any} & Record<any,any> | null
    let activeModal: {resolve: (val: OptionPickerReturns) => void, title: string, modal: ModalOptions } | undefined;
    let modalResults: Record<string | number | symbol, string> = {};

    export function picker(title: string,mdl: ModalOptions): Promise<OptionPickerReturns> {
        if (activeModal) forceCancel()

        return new Promise<OptionPickerReturns>((resolve,reject) => {
            activeModal = {
                resolve,
                title,
                modal:mdl
            }

            modalResults = {}
        })
    }

    export function forceCancel() {
        if (activeModal && activeModal.resolve) {
            activeModal.resolve(null)
        }
        activeModal = undefined
    }
</script>

{#if activeModal}
    <div class="modalContainer" transition:fade={{duration:200}}>
        <button class="mdHitbox" on:click|self={forceCancel}></button>
        <div class="modal" transition:slide={{duration:200}}>

            <div class="optPicker">

                <div class="category">
                    <p style:margin-bottom="10px">{activeModal.title}</p>
                </div>
                
                {#each activeModal.modal as option (option.id)}
                    {#if "inputSettings" in option}
                        <div class="inp">
                            <img src={option.icon} alt={option.id.toString()}>

                            <!-- i have to do this stupidness because of svelte but -->
                            <!-- its reason for blocking this is pretty good sooooo -->

                            {#if option.inputSettings.password}
                                <input placeholder={option.name} type="password" bind:value={modalResults[option.id]}>
                            {:else}
                                <input placeholder={option.name} bind:value={modalResults[option.id]}>
                            {/if}
                        </div>
                    {:else}
                        <button on:click={() => {activeModal?.resolve({...modalResults,selected:option.id});activeModal=undefined;modalResults={};}}>
                            <img src={option.icon} alt={option.id.toString()}>
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
    </div>
{/if}