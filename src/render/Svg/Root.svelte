<script lang="ts">
    import type { Size } from "@threlte/core";
    import MapObject from "./MapObject.svelte";
    import Wall from "./Wall.svelte";
    import { type MapRuntime, type MapObject as MObj } from "../../doom";
    import { useDoom } from "../DoomContext";

    export let size: Size;
    export let map: MapRuntime;

    const rev = map.rev;
    const { position, direction } = map.player;
    const showBlockmap = useDoom().settings.showBlockMap;

    let zoom = 500;
    $: left = $position.x - zoom * .5;
    $: top = $position.y - zoom * .5;
    let bounds = map.data.blockmap.bounds;

    function mousedown(ev: MouseEvent) {
        if (ev.buttons & 1) {
            map.game.input.attack = true;
        }
    }

    function mouseup(ev: MouseEvent) {
        if ((ev.buttons & 1) === 0) {
            map.game.input.attack = false;
        }
    }

    function mousewheel(ev: WheelEvent) {
        zoom = Math.max(100, Math.min(2000, zoom + ev.deltaY * 2));
    }

    function mousemove(ev: MouseEvent) {
        let p = new DOMPoint(ev.clientX, ev.clientY);
        let sp = p.matrixTransform((ev.target as any).getScreenCTM().inverse());
        // set player direction based on click location
        const ang = Math.atan2(sp.y - $position.y, sp.x - $position.x) + Math.PI;
        direction.set(ang);
    }

    let mobjs: MObj[] = [];
    $: if ($rev) {
        mobjs = map.objs;
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<svg
    width={size.width} height={size.height}
    viewBox="{left} {top} {zoom} {zoom}"
    on:mousemove={mousemove}
    on:mousedown={mousedown}
    on:mouseup={mouseup}
    on:wheel={mousewheel}
>
    <defs>
        <!-- https://developer.mozilla.org/en-US/docs/Web/SVG/Element/marker -->
        <!-- A marker to be used as an arrowhead -->
        <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" stroke="context-stroke" fill="context-fill"/>
        </marker>

        <pattern id="smallGrid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="grey" stroke-width="0.5"/>
        </pattern>
        <pattern id="grid" width="128" height="128" patternUnits="userSpaceOnUse">
            <!-- <rect width="128" height="128" fill="url(#smallGrid)"/> -->
            <path d="M 128 0 L 0 0 0 128" fill="none" stroke="grey" stroke-width="1"/>
        </pattern>
    </defs>

    <g>
        {#if $showBlockmap}
            <rect
                x={bounds.left} y={bounds.bottom}
                width={bounds.right - bounds.left} height={bounds.top - bounds.bottom}
                fill="url(#grid)" />
        {/if}

        {#each map.data.linedefs as linedef}
            <Wall {map} {linedef} />
        {/each}

        {#each mobjs as mobj (mobj.id)}
            <MapObject {mobj} />
        {/each}
    </g>
</svg>

<style>
    svg {
        /* invert top and bottom */
        transform: scaleY(-1);
        user-select: none;
    }
</style>
