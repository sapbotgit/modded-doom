<script lang="ts">
    import type { Size } from "@threlte/core";
    import MapObject from "./MapObject.svelte";
    import Wall from "./Wall.svelte";
    import { type MapRuntime, type MapObject as MObj } from "../../doom";
    import { useDoom, useDoomMap } from "../DoomContext";
    import { Color } from "three";
    import type { RenderSector } from "../RenderData";

    export let size: Size;
    export let map: MapRuntime;

    const rev = map.rev;
    const erev = map.erev;
    const { position, direction } = map.player;
    const showBlockmap = useDoom().settings.showBlockMap;

    let zoom = 500;
    $: left = $position.x - zoom * .5;
    $: top = $position.y - zoom * .5;
    let bounds = map.data.blockMapBounds;

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
        zoom = Math.max(50, Math.min(2000, zoom + ev.deltaY * 2));
    }

    function mousemove(ev: MouseEvent) {
        let p = new DOMPoint(ev.clientX, ev.clientY);
        let sp = p.matrixTransform((ev.target as any).getScreenCTM().inverse());
        // set player direction based on click location
        const ang = Math.atan2(sp.y - $position.y, sp.x - $position.x) + Math.PI;
        direction.set(ang);
    }

    let mobjs: MObj[] = [];
    $: if ($rev || $erev) {
        mobjs = [...map.objs, ...map.ephemeralObjs];
    }

    let selRS: RenderSector;
    function selectRS(rs: RenderSector) {
        // helpful for debugging...
        selRS = rs;
    }

    const debugShowSubsectors = false;
    const { renderSectors } = useDoomMap();
    const namedColor = (n: number) =>
        '#' + Object.values(Color.NAMES)[n % Object.keys(Color.NAMES).length].toString(16).padStart(6, '0');
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
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="grey" stroke-width="0.25"/>
        </pattern>
        <pattern id="grid" x={bounds.left} y={bounds.bottom} width="128" height="128" patternUnits="userSpaceOnUse">
            <!-- <rect width="128" height="128" fill="url(#smallGrid)"/> -->
            <path d="M 128 0 L 0 0 0 128" fill="none" stroke="grey" stroke-width="1"/>
        </pattern>
    </defs>

    <g
        stroke-linecap={'round'}
    >

        {#if debugShowSubsectors}
            {#each renderSectors as rs, i}
                {#each rs.subsectors as subsector, j}
                    <polygon
                        points={subsector.vertexes.map(e => e.x + ',' + e.y).join(' ')}
                        fill={namedColor(i)}
                        on:click={() => selectRS(rs)} />
                    <polygon
                        points={subsector.vertexes.map(e => e.x + ',' + e.y).join(' ')}
                        opacity={.1}
                        fill={namedColor(j)}
                        on:click={() => selectRS(rs)} />
                {/each}
            {/each}
        {/if}

        {#if $showBlockmap}
            <rect
                x={bounds.left} y={bounds.bottom}
                width={bounds.right - bounds.left} height={bounds.top - bounds.bottom}
                opacity={0.5}
                fill="url(#grid)" />
        {/if}

        {#each map.data.linedefs as linedef}
            <Wall {map} {linedef} />
        {/each}

        {#each mobjs as mobj (mobj.id)}
            <MapObject {mobj} />
        {/each}

        {#if selRS}
            <g class="selection-info">
                {#each selRS.subsectors as subsec}
                    {#each subsec.segs as seg}
                        <line x1={seg.v[0].x} y1={seg.v[0].y} x2={seg.v[1].x} y2={seg.v[1].y} stroke='yellow' stroke-width={3} />
                        <!-- <text x={(seg.v[0].x+seg.v[1].x)/2} y={-(seg.v[0].y+seg.v[1].y)/2} fill='yellow'>{seg.linedef.num}</text> -->
                    {/each}
                    {#each subsec.bspLines as line}
                        {@const x = 5000}
                        {@const m = (line[1].y - line[0].y) / (line[1].x - line[0].x + .00000001)}
                        {@const c = (m * -line[1].x) + line[1].y}
                        <line x1={line[0].x} y1={line[0].y} x2={line[1].x} y2={line[1].y} stroke='cyan' stroke-width={2} />
                        <line x1={-x} y1={-x * m + c} x2={x} y2={x * m + c} stroke='magenta' stroke-width={.2} />
                    {/each}
                    <rect x={subsec.bounds.left} y={subsec.bounds.top}
                        width={subsec.bounds.right - subsec.bounds.left} height={subsec.bounds.bottom - subsec.bounds.top}
                        stroke='orange' stroke-width={.4} fill='none' />
                    {#each subsec.vertexes as v}
                        <circle cx={v.x} cy={v.y} r={1} fill='blue' />
                        <text x={v.x} y={-v.y} fill='blue'>{v.x.toFixed(2)},{v.y.toFixed(2)}</text>
                    {/each}
                    <text x={subsec.bounds.left} y={-subsec.bounds.top - 10} fill='white'>{subsec.num}</text>
                {/each}
            </g>
        {/if}
    </g>
</svg>

<style>
    svg {
        /* invert top and bottom */
        transform: scaleY(-1);
        user-select: none;
    }

    g {
        pointer-events: none;
    }

    polygon {
        pointer-events: all;
    }

    text {
        font-size: .3em;
        transform: scaleY(-1);
    }
</style>
