<script lang="ts">
    import DoomPic from "../DoomPic.svelte";

    export let key: string;

    $: card =
        key === 'R' ? 2 :
        key ==='B' ? 0 :
        key ==='Y' ? 1 :
        key ==='r' ? 5 :
        key ==='b' ? 3 :
        4;
</script>
<DoomPic name={'STKEYS' + card} />
