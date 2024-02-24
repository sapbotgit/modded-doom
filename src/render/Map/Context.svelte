<script lang="ts">
    import { setContext } from "svelte";
    import { store, type MapRuntime } from "../../doom";
    import type { RenderSector } from "../RenderData";
    import { Color, Euler, Vector3 } from "three";
    import type { useDoomMap } from "../DoomContext";

    export let map: MapRuntime;
    export let renderSectors: RenderSector[];

    const camera = {
        position: store(new Vector3()),
        angle: store(new Euler(0, 0, 0, 'ZXY')),
    };
    const skyColor = new Color('grey');
    $: setContext<ReturnType<typeof useDoomMap>>('doom-map', { skyColor, map, renderSectors, camera });
</script>

{#if map}
    {#key map}
        <slot />
    {/key}
{/if}