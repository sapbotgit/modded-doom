<script lang="ts">
    import Flat from "./Flat.svelte";
    import type { RenderSector } from "../RenderData";

    export let renderSector: RenderSector;

    // FIXME: cage floors and ceilings in plutonia's MAP24 are definitely not right
    // FIXME: while I'm at it, what is up with sector 198 and 239 in plutonia MAP28? The height seems wrong.
    // UPDATE: Apparently there is a sector (199 and 241) with zfloor -10 (instead of -24) but that sector ends up
    // basically not rendering because the lower sector takes up all the subsector vertexes. Hmmm
    // UPDATE2: I think it's something called "deep water" and I'm not sure how to handle it
    // https://doomwiki.org/wiki/Making_a_self-referencing_sector
    // https://doomwiki.org/wiki/Making_deep_water
    // FIXME: tnt/MAP02 also has this (sector 111) and some transparent barriers (eg. sector 93)
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