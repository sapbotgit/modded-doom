<script lang="ts">
    import Picture from "../Components/Picture.svelte";

    export let key: string;

    $: card =
        key === 'R' ? 2 :
        key === 'B' ? 0 :
        key === 'Y' ? 1 :
        key === 'r' ? 5 :
        key === 'b' ? 3 :
        4;
</script>
<Picture name={'STKEYS' + card} />
