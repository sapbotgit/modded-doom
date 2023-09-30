<script lang="ts">
    import Picture from "../Components/Picture.svelte";

    export let value: number;
    export let percent = false;

    $: value = Math.max(0, value); // don't display negatives
    let width = percent ? 64 : 48;
</script>

<div style={`width:${width}px`}>
    {#if value >= 100}
        <Picture name={`STTNUM${Math.trunc(value / 100) % 10}`} />
    {:else}
        <span class="space" />
    {/if}
    {#if value >= 10}
        <Picture name={`STTNUM${Math.trunc(value / 10) % 10}`} />
    {:else}
        <span class="space" />
    {/if}
    <Picture name={`STTNUM${Math.trunc(value % 10)}`} />
    {#if percent}
        <Picture name={'STTPRCNT'} />
    {/if}
</div>

<style>
    div {
        display: inline-flex;
        flex-direction: row;
        justify-content: flex-end;
    }

    .space {
        width: 12px;
        display: inline-block;
    }
</style>