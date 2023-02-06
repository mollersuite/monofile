<script>

    import { fade } from "svelte/transition";

</script>
<div 
    class="pulldown_display"
    transition:fade={{duration:200}} 
>
    <slot />
</div>