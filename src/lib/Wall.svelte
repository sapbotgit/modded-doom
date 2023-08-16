<script lang="ts">
    import type { Seg } from "../doom";
    import { HALF_PI, angleIsVisible, signedLineDistance } from "../doom/Math";
    import WallSegment from "./WallSegment.svelte";
    import { useDoom } from "./useDoom";

    export let seg: Seg;
    const linedef = seg.linedef;

    const { game } = useDoom();
    const { direction: playerDirection, position: playerPosition } = game.player;
    $: visible =
        true;
        // angleIsVisible($playerDirection + Math.PI, seg.angle);
        // signedLineDistance is actually better (we display less geometry) but overall more expensive
        // so until we start using bsp, let's keep using the visible angle thing
        // signedLineDistance(linedef.v, $playerPosition as any) * (seg.direction ? 1 : -1) < 0;

    const mid = {
        x: (seg.vx2.x + seg.vx1.x) * 0.5,
        y: (seg.vx2.y + seg.vx1.y) * 0.5,
    };
    const vx = seg.vx2.x - seg.vx1.x;
    const vy = seg.vx2.y - seg.vx1.y;
    const width = Math.sqrt(vx * vx + vy * vy);

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
    // (2) use giant walls with renderOrder=0, writeColor=false, and writeDepth=true)
    //   for sky to occlude geometry behind them
    //
    // What I really want to do is not draw stuff that occluded but I can't
    // think of way to do that. Overall we draw way more geometry than needed so
    // that is something that needs improvement
    const needSkyWall = $ceilFlatR === 'F_SKY1'
    const skyHack = ($ceilFlatL === 'F_SKY1' && needSkyWall);
</script>

{#if sidedef && width > 0}
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

        {#if needSkyWall && !skyHack}
            <WallSegment
                skyHack
                {seg} {linedef} {sidedef}
                {visible} {width} height={32000 - $zCeilR} top={32000} {mid}
            />
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

        {#if needSkyWall}
            <WallSegment
                skyHack
                {seg} {linedef} {sidedef}
                {visible} {width} height={32000 - top} top={32000} {mid}
            />
        {/if}
    {/if}
{/if}
