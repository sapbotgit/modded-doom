<script lang="ts">
    import { setContext } from "svelte";
    import { store, type MapRuntime } from "../../doom";
    import type { RenderSector } from "../RenderData";
    import { Euler, Vector3 } from "three";

    export let map: MapRuntime;
    export let renderSectors: RenderSector[];

    const camera = {
        position: store(new Vector3()),
        angle: store(new Euler(0, 0, 0, 'ZXY')),
    };
    $: setContext('doom-map', { map, renderSectors, camera });
</script>

{#if map}
    {#key map.name}
        <slot />
    {/key}
{/if}