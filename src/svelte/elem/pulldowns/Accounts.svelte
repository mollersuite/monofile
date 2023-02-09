<script>
    import Pulldown from "./Pulldown.svelte"
    import { padding_scaleY } from "../transition/padding_scaleY"
    import { circIn,circOut } from "svelte/easing"

    let targetAction
</script>

<Pulldown name="accounts">
    <div class="notLoggedIn">
        <div class="container_div">
            <h1>monofile <span style:color="#999999">accounts</span></h1>
            <p class="flavor">Gain control of your uploads.</p>

            {#if targetAction}

                <div class="fields" out:padding_scaleY|local={{easingFunc:circIn}} in:padding_scaleY|local>
                    <input placeholder="username" type="text">
                    <input placeholder="password" type="password">
                    <button>{targetAction=="login" ? "Log in" : "Create account"}</button>
                </div>

            {:else}

                <div class="lgBtnContainer" out:padding_scaleY|local={{easingFunc:circIn}} in:padding_scaleY|local>
                    <button on:click={() => targetAction="login"}>Log in</button>
                    <button on:click={() => targetAction="create"}>Sign up</button>
                </div>

            {/if}
        </div>
    </div>
</Pulldown>