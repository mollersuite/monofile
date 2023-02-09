<script>
    import Pulldown from "./Pulldown.svelte"
    import { _void } from "../transition/_void"

    let targetAction
</script>

<Pulldown name="accounts">
    <div class="notLoggedIn">
        <div class="container_div">
            <h1>monofile <span style:color="#999999">accounts</span></h1>
            <p class="flavor">Gain control of your uploads.</p>

            {#if targetAction}

                <div class="fields" transition:_void|local>
                    <input placeholder="username">
                    <input placeholder="password" type="password">
                    <button>{targetAction=="login" ? "Log in" : "Create account"}</button>
                </div>

            {:else}

                <div class="lgBtnContainer" transition:_void|local>
                    <button on:click={() => targetAction="login"}>Log in</button>
                    <button on:click={() => targetAction="create"}>Sign up</button>
                </div>

            {/if}
        </div>
    </div>
</Pulldown>