<script lang="ts">
    import Flat from "./Flat.svelte";
    import type { RenderSector } from "../RenderData";

    export let renderSector: RenderSector;

    const { geometry, zFloor, zCeil, floorFlat, ceilFlat } = renderSector;
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