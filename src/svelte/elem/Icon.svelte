<script context="module">

    let iconCache = new Map()

</script>

<script>
    export let icon; // like "admin/___"
    let iconSrc;

    if (iconCache.has(icon)) {
        iconSrc = iconCache.get(icon)
    } else {
        fetch(`/static/assets/icons/${icon}`).then((response) => {
            if (response.ok) response.text().then(src => {
                iconCache.set( icon, src )
                iconSrc = src
            })
        })
    }

</script>

<div class="iconContainer">
    {@html iconSrc} <!-- TODO: !! MITM attack very possible here so we'll need to purify this later! -->
</div>