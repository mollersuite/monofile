<script lang=ts>

    import { fade } from "svelte/transition";

    export let name: string;

</script>
<div 
    class="pulldown_display"
    data-name={name}
    transition:fade={{duration:150}} 
>
    <slot />
</div>