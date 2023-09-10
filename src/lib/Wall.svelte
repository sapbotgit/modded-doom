<script lang="ts">
    import type { Seg } from "../doom";
    import WallSegment from "./WallSegment.svelte";

    export let seg: Seg;

    const visible = true;
    const mid = {
        x: (seg.vx2.x + seg.vx1.x) * 0.5,
        y: (seg.vx2.y + seg.vx1.y) * 0.5,
    };
    const vx = seg.vx2.x - seg.vx1.x;
    const vy = seg.vx2.y - seg.vx1.y;
    const width = Math.sqrt(vx * vx + vy * vy);

    const linedef = seg.linedef;
    const useLeft = seg.direction === 1;
    const sidedef = useLeft ? linedef.left : linedef.right;
    const { flags } = linedef;
    const { zFloor : zFloorL, zCeil : zCeilL } = linedef.left?.sector ?? {};
    const { middle: middleL }  = linedef.left ?? {};
    const { zFloor : zFloorR, zCeil : zCeilR } = linedef.right.sector
    const { middle: middleR }  = linedef.right;

    // sky-hack https://doomwiki.org/wiki/Sky_hack
    const { ceilFlat: ceilFlatL } = linedef.left?.sector ?? {};
    const { ceilFlat: ceilFlatR } = linedef.right.sector;

    // Detect the skyhack is simple but how it's handled is... messy. How it
    // works is:
    // (1) we set render order to 1 for everything non-sky
    // (2) put extra walls from top of line to sky with (renderOrder=0, writeColor=false, and writeDepth=true)
    //   to occlude geometry behind them
    //
    // These extra walls are mostly fine but not perfect. If you go close to an edge and look toward the bunker thing
    // you can see part of the walls occluded which shouldn't be. Interestingly you can see the same thing in gzDoom
    //
    // What I really want to do is not draw stuff that occluded but I can't think of way to do that.
    // Overall we draw way more geometry than needed.
    //
    // See also E3M6 https://doomwiki.org/wiki/File:E3m6_three.PNG
    const needSkyWall = $ceilFlatR === 'F_SKY1'
    const skyHack = ($ceilFlatL === 'F_SKY1' && needSkyWall);
    const skyHeight = linedef.right.sector.skyHeight;

    // FIXME: what is up with plutonia Map28 and sector 199/198?
</script>

{#if sidedef && width > 0}
    {#if needSkyWall && !skyHack}
        <WallSegment
            skyHack
            {seg} {linedef} {sidedef}
            {visible} {width} height={skyHeight - $zCeilR} top={skyHeight} {mid}
        />
    {/if}

    {#if flags & 0x0004}
        <!-- two-sided so figure out top and bottom -->
        {#if $zCeilL !== $zCeilR && !skyHack}
            {@const height = useLeft ? $zCeilL - $zCeilR : $zCeilR - $zCeilL}
            {@const top = Math.max($zCeilR, $zCeilL)}
            {#if height > 0}
                <WallSegment
                    {seg} {linedef} {sidedef}
                    {visible} {width} {height} {top} {mid}
                    type={'upper'}
                />
            {/if}
        {/if}
        {#if $zFloorL !== $zFloorR}
            {@const height = useLeft ? $zFloorR - $zFloorL : $zFloorL - $zFloorR}
            {@const top = Math.max($zFloorR, $zFloorL)}
            {#if height > 0}
                <WallSegment
                    {seg} {linedef} {sidedef}
                    {visible} {width} {height} {top} {mid}
                    type={'lower'}
                />
            {/if}
        {/if}
        <!-- And middle -->
        {#if seg.direction === 1 ? $middleL : $middleR}
            {@const top = Math.min($zCeilL, $zCeilR)}
            {@const height = top - Math.max($zFloorL, $zFloorR)}
            {#if height > 0}
                <WallSegment
                    {seg} {linedef} {sidedef}
                    {visible} {width} {height} {top} {mid}
                />
            {/if}
        {/if}

    {:else}
        {@const top = $zCeilR}
        {@const height = top - $zFloorR}
        {#if height > 0}
            <WallSegment
                {seg} {linedef} {sidedef}
                {visible} {width} {height} {top} {mid}
            />
        {/if}
    {/if}
{/if}
