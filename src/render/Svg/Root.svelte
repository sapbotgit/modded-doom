<script lang="ts">
    import type { Size } from "@threlte/core";
    import MapObject from "./MapObject.svelte";
    import Wall from "./Wall.svelte";
    import { HALF_PI, ToDegrees, type MapRuntime, type MapObject as MObj } from "../../doom";
    import { useDoom } from "../DoomContext";

    export let size: Size;
    export let map: MapRuntime;

    const rev = map.rev;
    const { position, direction } = map.player;
    const showBlockmap = useDoom().settings.showBlockMap;

    const width = 500;
    const height = 500;
    $: left = $position.x - width * .5;
    $: top = $position.y - height * .5;
    let bounds = map.data.blockmap.bounds;

    let svg;
    let pt;
    function touchMap(ev) {
        if (!pt) {
            pt = svg.createSVGPoint();
        }
        pt.x = ev.clientX;
        pt.y = ev.clientY;
        // very cool https://stackoverflow.com/questions/29261304
        let cp =  pt.matrixTransform(svg.getScreenCTM().inverse());
        // let node: TreeNode | SubSector = map.nodes[map.nodes.length - 1];
        // while (true) {
        //     if ('segs' in node) {
        //         console.log(node.sector);
        //         return;
        //     }
        //     // is Left https://stackoverflow.com/questions/1560492
        //     const cross = (node.v[1].x - node.v[0].x) * (cp.y - node.v[0].y) - (node.v[1].y - node.v[0].y) * (cp.x - node.v[0].x);
        //     if (cross > 0) {
        //         node = node.childLeft
        //     } else {
        //         node = node.childRight;
        //     }
        // }
    }

    let mobjs: MObj[] = [];
    $: if ($rev) {
        mobjs = map.objs;
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<svg
    width={size.width} height={size.height}
    viewBox="{left} {top} {width} {height}"
    on:click={touchMap} bind:this={svg}
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

    <g
        transform="
            rotate({(-$direction - HALF_PI) * ToDegrees} {$position.x} {$position.y})
        "
    >
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
    }
</style>
