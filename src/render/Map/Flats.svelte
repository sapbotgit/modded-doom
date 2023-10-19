<script lang="ts">
    import Flat from "./Flat.svelte";
    import type { RenderSector } from "../RenderData";

    export let renderSector: RenderSector;

    const geometry = renderSector.geometry;
    const { zFloor, zCeil, floorFlat, ceilFlat } = renderSector.sector;
</script>

{#if geometry}
    <Flat
        {renderSector}
        vertical={$zFloor}
        textureName={$floorFlat}
    />

    <Flat
        ceiling
        {renderSector}
        vertical={renderSector.sector.skyHeight ?? $zCeil}
        textureName={$ceilFlat}
    />
{/if}