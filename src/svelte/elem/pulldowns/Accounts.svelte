<script>
    import Pulldown from "./Pulldown.svelte"
    import { padding_scaleY } from "../transition/padding_scaleY"
    import { circIn,circOut } from "svelte/easing"
    import { account, fetchAccountData, serverStats } from "../stores.mjs";
    import { fade } from "svelte/transition";
    import OptionPicker from "../prompts/OptionPicker.svelte";
    import * as accOpts from "../prompts/account";
    import * as uplOpts from "../prompts/uploads";

    let targetAction
    let inProgress
    let authError

    let pwErr

    let optPicker;

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
            } else {
                authError = null, username = "", password = "";
                fetchAccountData();
            }
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
    <OptionPicker bind:this={optPicker} />
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
                Hey there, <span class="monospace">@{$account.username}</span>
            </h1>

            <div class="optPicker">

                <div class="category">
                    <p>Account</p>
                </div>

                <button on:click={() => accOpts.userChange(optPicker)}>
                    <img src="/static/assets/icons/change_username.svg" alt="change username">
                    <p>Change username</p>
                </button>

                <button on:click={() => accOpts.pwdChng(optPicker)}>
                    <img src="/static/assets/icons/change_password.svg" alt="change password">
                    <p>Change password<span><br />You will be logged out of all sessions</span></p>
                </button>
                
                {#if !$account.admin}
                    <button on:click={() => accOpts.deleteAccount(optPicker)}>
                        <img src="/static/assets/icons/delete_account.svg" alt="delete account">
                        <p>Delete account</p>
                    </button>
                {/if}

                <div class="category">
                    <p>Uploads</p>
                </div>

                <button on:click={() => uplOpts.dfv(optPicker)}>
                    <img src={`/static/assets/icons/${$account.defaultFileVisibility || "public"}.svg`} alt={$account.defaultFileVisibility || "public"}>
                    <p>Default file visibility<span><br />Uploads will be <strong>{$account.defaultFileVisibility || "public"}</strong> by default</span></p>
                </button>

                <button on:click={() => uplOpts.update_all_files(optPicker)}>
                    <img src="/static/assets/icons/update.svg" alt="update">
                    <p>Make all of my files {$account.defaultFileVisibility || "public"}<span><br />Matches your default file visibility</p>
                </button>
                
                <div class="category">
                    <p>Sessions</p>
                </div>

                <button on:click={() => fetch(`/auth/logout_sessions`,{method:"POST"}).then(() => fetchAccountData())}>
                    <img src="/static/assets/icons/logout_all.svg" alt="logout_all">
                    <p>Log out all sessions<span><br />{$account.sessionCount} session(s) active</span></p>
                </button>

                <button on:click={() => fetch(`/auth/logout`,{method:"POST"}).then(() => fetchAccountData())}>
                    <img src="/static/assets/icons/logout.svg" alt="logout">
                    <p>Log out<span><br />Session expires {new Date($account.sessionExpires).toLocaleDateString()}</span></p>
                </button>
                
                {#if $account.admin}

                    <div class="category">
                        <p>Admin</p>
                    </div>

                    <button>
                        <img src="/static/assets/icons/delete_account.svg" alt="delete account">
                        <p>Delete user account</p>
                    </button>

                    <button>
                        <img src="/static/assets/icons/change_password.svg" alt="change password">
                        <p>Change user password</p>
                    </button>

                    <button>
                        <img src="/static/assets/icons/admin/elevate_user.svg" alt="elevate account">
                        <p>Elevate account to admin</p>
                    </button>

                    <button>
                        <img src="/static/assets/icons/link.svg" alt="delete file">
                        <p>Change file owner</p>
                    </button>

                    <button>
                        <img src="/static/assets/icons/admin/delete_file.svg" alt="delete file">
                        <p>Delete file</p>
                    </button>

                {/if}
                <p style="font-size:12px;color:#AAAAAA;text-align:center;" class="monospace"><br />{$account.id}</p>
            </div>
        </div>
        
    {/if}
</Pulldown>