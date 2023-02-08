<script>
    import Pulldown from "./Pulldown.svelte"

    let faq = [
        {
            question : "test",
            answer   : "abc"
        }
    ]
</script>

<Pulldown name="faq">
    {#each faq as question}
        <div style="faqGroup">
            <h2>{question.question}</h2>
            <p>{question.answer}</p>
        </div>
    {/each}
</Pulldown>