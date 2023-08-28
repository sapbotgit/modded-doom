<script lang="ts">
    import DoomPic from "../DoomPic.svelte";
    import { useDoom } from "../DoomContext";

    export let value: number;
    export let altNum = false;

    const { wad } = useDoom();

    $: name = altNum ? 'STGNUM' : 'STYSNUM';
    $: hundredsGfx = wad.graphic(name + (Math.trunc(value / 100) % 10)) as any;
    $: tensGfx = wad.graphic(name + (Math.trunc(value / 10) % 10)) as any;
    $: onesGfx = wad.graphic(name + (value % 10)) as any;
</script>

<div style={`width:12px`}>
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
    <DoomPic data={onesGfx}  />
</div>

<style>
    div {
        display: inline-flex;
        flex-direction: row;
        justify-content: flex-end;
        position: relative;
    }

    .space {
        position: relative;
        width: 4px;
        display: inline-block;
    }
</style>