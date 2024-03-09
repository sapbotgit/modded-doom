<script lang="ts">
    import Picture from "./Picture.svelte";
    import { useDoom } from "../DoomContext";

    export let value: number;
    export let sprite: 'STGNUM' | 'STYSNUM' | 'STTNUM' | 'WINUM';
    export let percent = false;

    let { wad } = useDoom();

    $: gap = sprite === 'WINUM' ? 1.2 : 0;
    $: value = Math.max(0, value); // don't display negatives
    $: charWidth = wad.graphic(`${sprite}0`).width;
    $: width = (percent ? 4 : 3) * charWidth;
</script>

<div class="inline-flex justify-end" style='width:{width}px; gap:{gap}px;'>
    {#if value >= 100}
        <Picture name={`${sprite}${Math.trunc(value / 100) % 10}`} />
    {/if}
    {#if value >= 10}
        <Picture name={`${sprite}${Math.trunc(value / 10) % 10}`} />
    {/if}
    <Picture name={`${sprite}${Math.trunc(value % 10)}`} />
    {#if percent}
        <Picture name={sprite === 'WINUM' ? 'WIPCNT' : 'STTPRCNT'} />
    {/if}
</div>
