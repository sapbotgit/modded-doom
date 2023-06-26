<script lang="ts">
    import { onDestroy } from "svelte";
    import type { LineDef } from "../doomwad";
    import WallSegment from "./WallSegment.svelte";
    import { useDoom } from "./useDoom";

    export let linedef: LineDef;

    const { game } = useDoom();

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
    const { zFloor : zFloorR, zCeil : zCeilR } = linedef.right.sector

    let scrollOffsetX = 0;
    let scrollTick: () => void = null;
    function stopScrollAnimation() {
        scrollOffsetX = 0;
        game.removeEventListener('frameTick', scrollTick);
    }
    onDestroy(stopScrollAnimation);

    const scrollLeft = () => scrollOffsetX += 1;
    const scrollRight = () => scrollOffsetX -= 1;
    $: if (linedef.special === 48) {
        stopScrollAnimation();
        scrollTick = scrollLeft;
        game.addEventListener('frameTick', scrollTick);
    } else if (linedef.special === 85) {
        stopScrollAnimation();
        scrollTick = scrollRight;
        game.addEventListener('frameTick', scrollTick);
    } else {
        stopScrollAnimation();
    }
</script>

{#if linedef.flags & 0x0004}
    <!-- two-sided so figure out top and bottom -->
    {#if $zCeilL !== $zCeilR}
        {@const useLeft = $zCeilL > $zCeilR}
        {@const height = Math.abs($zCeilL - $zCeilR)}
        {@const top = Math.max($zCeilR, $zCeilL)}
        <WallSegment
            {linedef}
            {width} {angle} {mid} {top} {height} {scrollOffsetX}
            {useLeft}
            type={'upper'}
            textureName={useLeft ? linedef.left.upper : linedef.right.upper}
            sidedef={useLeft ? linedef.left : linedef.right}
        />
    {/if}
    {#if $zFloorL !== $zFloorR}
        {@const useLeft = $zFloorL < $zFloorR}
        {@const height = Math.abs($zFloorL - $zFloorR)}
        {@const top = Math.max($zFloorR, $zFloorL)}
        <WallSegment
            {linedef}
            {width} {angle} {mid} {top} {height} {scrollOffsetX}
            {useLeft}
            type={'lower'}
            textureName={useLeft ? linedef.left.lower : linedef.right.lower}
            sidedef={useLeft ? linedef.left : linedef.right}
        />
    {/if}
    <!-- And middle(s) -->
    {@const top = Math.min($zCeilL, $zCeilR)}
    {@const height = top - Math.max($zFloorL, $zFloorR)}
    {#if linedef.left.middle}
        <WallSegment
            {linedef}
            {width} {angle} {mid} {top} {height} {scrollOffsetX}
            useLeft
            textureName={linedef.left.middle}
            sidedef={linedef.left}
        />
    {/if}
    {#if linedef.right.middle}
        <WallSegment
            {linedef}
            {width} {angle} {mid} {height} {top} {scrollOffsetX}
            textureName={linedef.right.middle}
            sidedef={linedef.right}
        />
    {/if}
{:else}
    {@const top = $zCeilR}
    {@const height = top - $zFloorR}
    <WallSegment
        {linedef}
        {width} {angle} {mid} {top} {height} {scrollOffsetX}
        textureName={linedef.right.middle}
        sidedef={linedef.right}
    />
{/if}
