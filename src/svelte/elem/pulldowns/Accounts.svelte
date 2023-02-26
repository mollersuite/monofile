<script>
    import Pulldown from "./Pulldown.svelte"
    import { padding_scaleY } from "../transition/padding_scaleY"
    import { circIn,circOut } from "svelte/easing"
    import { account, fetchAccountData, serverStats } from "../stores.mjs";
    import { fade } from "svelte/transition";

    let targetAction
    let inProgress
    let authError

    let pwErr

    // lazy

    let username
    let password

    let execute = () => {
        if (inProgress) return

        inProgress = true

        fetch(`/auth/${targetAction}`, {
            method: "POST",
            body: JSON.stringify({
                username, password
            })
        }).then(async (res) => {
            inProgress = false

            if (res.status != 200) {
                authError = await res.json().catch(() => {
                    return {
                        status: res.status,
                        message: res.statusText
                    }
                })
            }

            fetchAccountData();


        }).catch(() => {})
    }

    $: {
        if (pwErr && authError) {
            pwErr.animate({
                backgroundColor: ["#885555","#663333"],
                easing: "ease-out"
            },650)
        }
    }

    // actual account menu


    
</script>

<Pulldown name="accounts">
    {#if Object.keys($account).length == 0}

        <div class="notLoggedIn" transition:fade={{duration:200}}>
            <div class="container_div">
                <h1>monofile <span style:color="#999999">accounts</span></h1>
                <p class="flavor">Gain control of your uploads.</p>

                {#if targetAction}

                    <div class="fields" out:padding_scaleY|local={{easingFunc:circIn}} in:padding_scaleY|local>
                        {#if !$serverStats.accounts.registrationEnabled && targetAction == "create"}
                            <div class="pwError">
                                <div style:background-color="#554C33">
                                    <p>Account registration has been disabled by this instance's owner</p>
                                </div>
                            </div>
                        {/if}
                        
                        {#if authError}
                            <div class="pwError" out:padding_scaleY|local={{easingFunc:circIn}} in:padding_scaleY|local>
                                <div bind:this={pwErr}>
                                    <p><strong>{authError.status}</strong> {authError.message}</p>
                                </div>
                            </div>
                        {/if}

                        <input placeholder="username" type="text" bind:value={username}>
                        <input placeholder="password" type="password" bind:value={password}>
                        <button on:click={execute}>{ inProgress ? "• • •" : (targetAction=="login" ? "Log in" : "Create account") }</button>
                    </div>

                {:else}

                    <div class="lgBtnContainer" out:padding_scaleY|local={{easingFunc:circIn}} in:padding_scaleY|local>
                        <button on:click={() => targetAction="login"}>Log in</button>
                        <button on:click={() => targetAction="create"}>Sign up</button>
                    </div>

                {/if}
            </div>
        </div>

    {:else}

        <div class="loggedIn" transition:fade={{duration:200}}>
            <h1>
                Hey there, <span class="monospace" style:font-size="18px">@{$account.username}</span>
            </h1>

            <div style:min-height="10px" style:border-bottom="1px solid #AAAAAA" />

            <div class="accountOptions">
                <button>
                    <img src="/static/assets/icons/change_password.svg" alt="change password">
                    <p>Change password</p>
                </button>

                <button>
                    <img src="/static/assets/icons/delete_account.svg" alt="delete account">
                    <p>Delete account</p>
                </button>

                <button on:click={() => fetch(`/auth/logout`,{method:"POST"}).then(() => fetchAccountData())}>
                    <img src="/static/assets/icons/logout.svg" alt="logout">
                    <p>Log out</p>
                </button>
            </div>
        </div>
        
    {/if}
</Pulldown>