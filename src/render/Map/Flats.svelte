<script lang="ts">
    import Flat from "./Flat.svelte";
    import type { RenderSector } from "../RenderData";

    export let renderSector: RenderSector;

    const { zFloor, zCeil, floorFlat, ceilFlat } = renderSector.sector;
    const { geometry, zHackCeil, zHackFloor } = renderSector;
</script>

{#if geometry}
    <Flat
        {renderSector}
        vertical={$zFloor + $zHackFloor}
        textureName={$floorFlat}
    />

    <Flat
        ceiling
        {renderSector}
        vertical={(renderSector.sector.skyHeight ?? $zCeil) + $zHackCeil}
        textureName={$ceilFlat}
    />
{/if}