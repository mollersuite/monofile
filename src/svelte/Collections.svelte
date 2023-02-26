<script>
    import { onMount } from "svelte";

    let collection = {}
</script>

<div id="appContent">
    <div id="uploadWindow">
        <h2>{collection.name}</h2>
        <p><span class="number">{collection.id}</span>&nbsp;&nbsp—&nbsp;&nbsp;by <strong>@{collection.owner}</strong></p>
    </div>
</div>