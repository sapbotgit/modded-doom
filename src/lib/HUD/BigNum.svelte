<script lang="ts">
    import DoomPic from "../DoomPic.svelte";

    export let value: number;
    export let percent = false;

    let width = percent ? 64 : 48;
</script>

<div style={`width:${width}px`}>
    {#if value >= 100}
        <DoomPic name={`STTNUM${Math.trunc(value / 100) % 10}`} />
    {:else}
        <span class="space" />
    {/if}
    {#if value >= 10}
        <DoomPic name={`STTNUM${Math.trunc(value / 10) % 10}`} />
    {:else}
        <span class="space" />
    {/if}
    <DoomPic name={`STTNUM${value % 10}`} />
    {#if percent}
        <DoomPic name={'STTPRCNT'} />
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