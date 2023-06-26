<script lang="ts">
    import type { LineDef } from "../doomwad";
    import WallSegment from "./WallSegment.svelte";

    export let linedef: LineDef;

    $: mid = {
        x: (linedef.v2.x + linedef.v1.x) * 0.5,
        y: (linedef.v2.y + linedef.v1.y) * 0.5,
    };
    $: vx = linedef.v2.x - linedef.v1.x;
    $: vy = linedef.v2.y - linedef.v1.y;
    $: width = Math.sqrt(vx * vx + vy * vy);
    $: invlen = 1 / width;
    $: angle = Math.atan2(vy * invlen, vx * invlen);

    const { zFloor : zFloorL, zCeil : zCeilL } = linedef.left?.sector ?? {};
    const { upper: upperL, lower: lowerL, middle: middleL }  = linedef.left ?? {};
    const { zFloor : zFloorR, zCeil : zCeilR } = linedef.right.sector
    const { middle: middleR }  = linedef.right;
</script>

{#if linedef.flags & 0x0004}
    <!-- two-sided so figure out top and bottom -->
    {#if $zCeilL !== $zCeilR}
        {@const useLeft = $zCeilL > $zCeilR}
        {@const height = Math.abs($zCeilL - $zCeilR)}
        {@const top = Math.max($zCeilR, $zCeilL)}
        <WallSegment
            {linedef} {useLeft}
            {width} {angle} {mid} {top} {height}
            sidedef={useLeft ? linedef.left : linedef.right}
            type={'upper'}
        />
    {/if}
    {#if $zFloorL !== $zFloorR}
        {@const useLeft = $zFloorL < $zFloorR}
        {@const height = Math.abs($zFloorL - $zFloorR)}
        {@const top = Math.max($zFloorR, $zFloorL)}
        <WallSegment
            {linedef} {useLeft}
            {width} {angle} {mid} {top} {height}
            sidedef={useLeft ? linedef.left : linedef.right}
            type={'lower'}
        />
    {/if}
    <!-- And middle(s) -->
    {@const top = Math.min($zCeilL, $zCeilR)}
    {@const height = top - Math.max($zFloorL, $zFloorR)}
    {#if $middleL}
        <WallSegment
            {linedef} useLeft
            {width} {angle} {mid} {top} {height}
            sidedef={linedef.left}
        />
    {/if}
    {#if $middleR}
        <WallSegment
            {linedef}
            {width} {angle} {mid} {height} {top}
            sidedef={linedef.right}
        />
    {/if}
{:else}
    {@const top = $zCeilR}
    {@const height = top - $zFloorR}
    <WallSegment
        {linedef}
        {width} {angle} {mid} {top} {height}
        sidedef={linedef.right}
    />
{/if}
