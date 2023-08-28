<script lang="ts">
    import DoomPic from "../DoomPic.svelte";
    import { useDoom } from "../DoomContext";

    export let value: number;
    export let percent = false;

    const { wad } = useDoom();
    const percentGfx = wad.graphic('STTPRCNT') as any;

    // STTNUM1 is 11px instead of 16px like the other numbers so we have to adjust
    // spacing when we have a 1
    // $: oneSpace = value % 10 === 1;
    $: hundredsGfx = wad.graphic(`STTNUM${Math.trunc(value / 100) % 10}`) as any;
    $: tensGfx = wad.graphic(`STTNUM${Math.trunc(value / 10) % 10}`) as any;
    $: onesGfx = wad.graphic(`STTNUM${value % 10}`) as any;
    let width = percent ? 64 : 48;
</script>

<div style={`width:${width}px`}>
    {#if value >= 100}
        <DoomPic data={hundredsGfx} />
    {:else}
        <span class="space" />
    {/if}
    {#if value >= 10}
        <DoomPic data={tensGfx} />
    {:else}
        <span class="space" />
    {/if}
    <DoomPic data={onesGfx} />
    {#if percent}
        <DoomPic data={percentGfx} />
    {/if}
</div>

<style>
    div {
        display: inline-flex;
        flex-direction: row;
        justify-content: flex-end;
        position: relative;
    }

    .space {
        width: 12px;
        display: inline-block;
    }
</style>