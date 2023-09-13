<script lang="ts">
    import Picture from "../Components/Picture.svelte";

    export let value: number;
    export let altNum = false;

    $: name = altNum ? 'STGNUM' : 'STYSNUM';
</script>

<div style={`width:12px`}>
    {#if value >= 100}
        <Picture name={name + (Math.trunc(value / 100) % 10)} />
    {:else}
        <span class="space" />
    {/if}
    {#if value >= 10}
        <Picture name={name + (Math.trunc(value / 10) % 10)} />
    {:else}
        <span class="space" />
    {/if}
    <Picture name={name + (value % 10)}  />
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