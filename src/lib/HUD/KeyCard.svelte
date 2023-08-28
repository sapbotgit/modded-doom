<script lang="ts">
    import DoomPic from "../DoomPic.svelte";
    import { useDoom } from "../DoomContext";

    export let key: string;

    const { wad } = useDoom();

    $: card =
        key === 'R' ? 2 :
        key ==='B' ? 0 :
        key ==='Y' ? 1 :
        key ==='r' ? 5 :
        key ==='b' ? 3 :
        4;
    $: data = wad.graphic('STKEYS' + card) as any;
</script>
<DoomPic {data} />
