<script lang="ts">
    import Picture from "../Components/Picture.svelte";

    export let value: number;
    export let altNum = false;

    $: value = Math.max(0, value); // don't display negatives
    $: name = altNum ? 'STGNUM' : 'STYSNUM';
</script>

<div style={`width:12px`}>
    {#if value >= 100}
        <Picture name={name + (Math.trunc(value / 100) % 10)} />
    {/if}
    {#if value >= 10}
        <Picture name={name + (Math.trunc(value / 10) % 10)} />
    {/if}
    <Picture name={name + Math.trunc(value % 10)}  />
</div>

<style>
    div {
        display: inline-flex;
        flex-direction: row;
        justify-content: flex-end;
    }
</style>