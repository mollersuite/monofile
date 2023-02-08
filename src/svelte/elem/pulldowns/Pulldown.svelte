<script>

    import { fade } from "svelte/transition";

    export let name;

</script>
<div 
    class="pulldown_display"
    name=name
    transition:fade={{duration:200}} 
>
    <slot />
</div>