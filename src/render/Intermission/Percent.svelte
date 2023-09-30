<script lang="ts">
    import Picture from "../Components/Picture.svelte";

    export let value: number;

    // TODO: can we combine this, Time.svelte and HUD's BigNum and SmallNum? They are all very similar (but maybe slightly different)
    $: hundreds = Math.floor(value / 100) % 10;
    $: tens = Math.floor(value / 10) % 10;
    $: ones = Math.floor(value % 10);
</script>

<div>
    {#if value >= 100}
        <Picture name="WINUM{hundreds}"/>
    {/if}
    {#if value >= 10}
        <Picture name="WINUM{tens}"/>
    {/if}
    <Picture name="WINUM{ones}"/>
    <Picture name="WIPCNT" />
</div>

<style>
    div {
        display: inline-flex;
        justify-content: flex-end;
        gap: 1.2px;
    }
</style>