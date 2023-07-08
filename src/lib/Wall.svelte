<script lang="ts">
    import type { Seg } from "../doomwad";
    import WallSegment from "./WallSegment.svelte";

    export let seg: Seg;
    const linedef = seg.linedef;

    const mid = {
        x: (seg.vx2.x + seg.vx1.x) * 0.5,
        y: (seg.vx2.y + seg.vx1.y) * 0.5,
    };
    const vx = seg.vx2.x - seg.vx1.x;
    const vy = seg.vx2.y - seg.vx1.y;
    const width = Math.sqrt(vx * vx + vy * vy);
    const angle = seg.angle;

    const useLeft = seg.direction === 1;
    const sidedef = useLeft ? linedef.left : linedef.right;
    const { flags } = linedef;
    const { zFloor : zFloorL, zCeil : zCeilL } = linedef.left?.sector ?? {};
    const { middle: middleL }  = linedef.left ?? {};
    const { zFloor : zFloorR, zCeil : zCeilR } = linedef.right.sector
    const { middle: middleR }  = linedef.right;

    // sky-hack https://doomwiki.org/wiki/Sky_hack
    const { ceilFlat: ceilFlatL } = linedef.left?.sector ?? {};
    const { ceilFlat: ceilFlatR } = linedef.right.sector
    const skyHack = ($ceilFlatL === 'F_SKY1' && $ceilFlatR === 'F_SKY1');
</script>

{#if sidedef}
    {#if flags & 0x0004}
        <!-- two-sided so figure out top and bottom -->
        {#if $zCeilL !== $zCeilR && !skyHack}
            {@const height = useLeft ? $zCeilL - $zCeilR : $zCeilR - $zCeilL}
            {@const top = Math.max($zCeilR, $zCeilL)}
            <WallSegment
                {seg} {linedef} {sidedef}
                {width} {angle} {mid} {top} {height}
                type={'upper'}
            />
        {/if}
        {#if $zFloorL !== $zFloorR}
            {@const height = useLeft ? $zFloorR - $zFloorL : $zFloorL - $zFloorR}
            {@const top = Math.max($zFloorR, $zFloorL)}
            <WallSegment
                {seg} {linedef} {sidedef}
                {width} {angle} {mid} {top} {height}
                type={'lower'}
            />
        {/if}
        <!-- And middle(s) -->
        {#if $middleL || $middleR}
            {@const top = Math.min($zCeilL, $zCeilR)}
            {@const height = top - Math.max($zFloorL, $zFloorR)}
            <WallSegment
                {seg} {linedef} {sidedef}
                {width} {angle} {mid} {top} {height}
            />
        {/if}
    {:else}
        {@const top = $zCeilR}
        {@const height = top - $zFloorR}
        <WallSegment
            {seg} {linedef} {sidedef}
            {width} {angle} {mid} {top} {height}
        />
    {/if}
{/if}