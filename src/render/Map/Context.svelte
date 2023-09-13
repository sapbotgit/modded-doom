<script lang="ts">
    import { setContext } from "svelte";
    import type { MapRuntime } from "../../doom";
    import type { RenderSector } from "../RenderData";

    export let map: MapRuntime;
    export let renderSectors: RenderSector[];

    $: setContext('doom-map', { map, renderSectors });
</script>

{#if map}
    {#key map.name}
        <slot />
    {/key}
{/if}