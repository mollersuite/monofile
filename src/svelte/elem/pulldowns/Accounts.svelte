<script>
    import Pulldown from "./Pulldown.svelte"
</script>

<Pulldown name="accounts">
    <div class="notLoggedIn">
        <div>
            <h1>monofile <span style:color="#999999">accounts</span></h1>
            <p class="flavor">Gain control of your uploads.</p>
            
            <a class="signUp" href="/signup">Sign up</a>
            <br />
            <a class="signIn" href="/login">Log in</a>
        </div>
    </div>
</Pulldown>