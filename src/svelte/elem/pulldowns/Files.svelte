<script>
    import Pulldown from "./Pulldown.svelte"
    import { pulldownManager } from "../stores.mjs";
</script>

<Pulldown name="files">

    <div class="notLoggedIn">
        <div style:height="2px" style:background-color="#66AAFF" />
        <div style:height="10px" />
        <p class="flavor">Log in to view uploads & collections</p>
        <button on:click={$pulldownManager.openPulldown("account")}>OK</button>
        <div style:height="14px" />
    </div>

    <!-- 
        put scrolling div containing options here
        if not logged in, most options will be hidden
        & the div containing the options will be resized
        (actually, maybe we could use flexbox for this)
    -->

    <!--
        <div>
            <h2>Anonymous file deletion</h2>
            <p>Enter your deletion code</p>
            <input placeholder="0000 0000 0000 0000">
        </div>
    -->

</Pulldown>