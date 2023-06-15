<script lang="ts">
    import type { DoomMap } from "../doomwad";

    export let map: DoomMap;

    let left = 0;
    let top = 0;
    let width = 0;
    let height = 0;
    $: if (map.vertexes) {
        left = map.vertexes[0].x;
        top = map.vertexes[0].y;
        let right = map.vertexes[0].x;
        let bottom = map.vertexes[0].y;
        for (const v of map.vertexes) {
            left = Math.min(v.x, left);
            right = Math.max(v.x, right);
            top = Math.min(v.y, top);
            bottom = Math.max(v.y, bottom);
        }
        width = Math.abs(left) + Math.abs(right);
        height = Math.abs(top) + Math.abs(bottom);
    }
</script>

<div>{map.name}</div>

<svg viewBox="{left} {top} {width} {height}">
    {#each map.linedefs as ld}
        <line x1={ld.vx1.x} y1={ld.vx1.y} x2={ld.vx2.x} y2={ld.vx2.y} stroke="white" />
    {/each}
</svg>

<style>
    svg {
        /* invert top and bottom */
        transform: scaley(-1);
    }
</style>