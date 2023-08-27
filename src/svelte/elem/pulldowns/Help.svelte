<!-- i'm lazy, could probably just use plain html here but hwatever, mgiht make this grab from the server idk -->

<script>
    import Pulldown from "./Pulldown.svelte"

    let faq = [
        {
            question : "Are my files compressed on upload?",
            answer   : "No. Files should stay completely unchanged on download."
        },
        {
            question : "How do I replace a file that I have previously uploaded?",
            answer   : "You can modify the content of a file that is linked to a file ID by reuploading the file using the same custom ID."
        }
    ]
</script>

<Pulldown name="help">
    {#each faq as question}
        <div class="faqGroup">
            <h2>{question.question}</h2>
            <p>{question.answer}</p>
        </div>
    {/each}
</Pulldown>