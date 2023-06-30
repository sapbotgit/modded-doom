<script lang="ts">
    import { Color } from "three";
    import type { DoomMap, DoomWad, LineDef, Sector, Thing, SideDef, Vertex, RenderThing } from "../../doomwad";
    import { ToRadians, intersectionPoint, signedLineDistance } from '../Math';
    import { MFFlags } from "../../doom-things-info";
    export let wad: DoomWad;
    export let map: DoomMap;

    const svgStartSector = true;
    const svgBspBoxes = false;
    const svgVertexes = false;
    const svgSubSectors = false;
    const svgThings = true;

    let sect: Sector;
    const padding = 40;
    let p1: Thing = null;
    let left = 0;
    let top = 0;
    let width = 0;
    let height = 0;
    $: if (map.vertexes) {
        p1 = map.things.find(e => e.type === 1);
        sect = map.findSector(p1.x, p1.y)

        left = map.vertexes[0].x;
        top = map.vertexes[0].y;
        let right = map.vertexes[0].x;
        let bottom = map.vertexes[0].y;
        for (const ld of map.linedefs) {
            left = Math.min(ld.v1.x, ld.v2.x, left);
            right = Math.max(ld.v1.x, ld.v2.x, right);
            top = Math.min(ld.v1.y, ld.v2.y, top);
            bottom = Math.max(ld.v1.y, ld.v2.y, bottom);
        }
        width = Math.abs(left - padding) + Math.abs(right + padding);
        height = Math.abs(top - padding) + Math.abs(bottom + padding);
    }

    function lineStroke(ld: LineDef) {
        return !ld.left ? wad.palettes[0][176] :
            (ld.left.sector.zFloor !== ld.right.sector.zFloor) ? wad.palettes[0][64] :
            (ld.left.sector.zCeil !== ld.right.sector.zCeil) ?  wad.palettes[0][231] :
            wad.palettes[0][96];
    }

    function namedColor(idx) {
        return Object.values(Color.NAMES)[idx % Object.keys(Color.NAMES).length];
    }

    let selectedRs: RenderSector;
    function clickSubsect(rs: RenderSector) {
        selectedRs = rs;
    }

    function bspPoints(bspLines: Vertex[][]) {
        let points = [];
        for (let i = 0; i < bspLines.length - 1; i++) {
            for (let j = i; j < bspLines.length; j++) {
                const point = intersectionPoint(bspLines[i], bspLines[j]);
                if (point) {
                    points.push(point);
                }
            }
        }
        return points;
    }

    function evalPoint(point: Vertex, rs: RenderSector) {
        console.log('ev-point', point, rs);
        let segLines = rs.subsec.segs.map(e => [e.vx1, e.vx2]);
        console.log(rs.bspLines.map(l => signedLineDistance(l, point)))
        console.log(segLines.map(l => signedLineDistance(l, point)))
    }

    function subsegPath(rsec: RenderSector) {
        let v = rsec.vertexes;
        let path = `M ${v[0].x} ${v[0].y}`;
        for (let i = 1; i < v.length; i++) {
            path += ` L ${v[i].x} ${v[i].y}`;
        }
        path += ` L ${v[0].x} ${v[0].y}`;
        return path;
    }

    function planeFrom(p1: Vertex, p2: Vertex) {
        const max = 10000;
        let dx = (p2.x - p1.x);
        const dy = (p2.y - p1.y);
        if (dx === 0) {
            return { x1: p1.x, y1: -max, x2: p1.x, y2:max };
        }

        const m = dy / dx;
        const c = m * -p1.x + p1.y;
        const x1 = -max;
        const y1 = x1 * m + c;
        const x2 = max;
        const y2 = x2 * m + c;
        return { x1, y1, x2, y2 };
    }

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
        //     const cross = (node.v2.x - node.v1.x) * (cp.y - node.v1.y) - (node.v2.y - node.v1.y) * (cp.x - node.v1.x);
        //     if (cross > 0) {
        //         node = node.childLeft
        //     } else {
        //         node = node.childRight;
        //     }
        // }
    }

    function thingColor(th: RenderThing) {
        const c = th.source.type <= 4 ? Color.NAMES.green :
            th.source.type === 11 ? Color.NAMES.lightgreen :
            th.spec.class === 'M' ? Color.NAMES.red :
            th.spec.class === 'W' ? Color.NAMES.orange :
            th.spec.class === 'A' ? Color.NAMES.yellow :
            th.spec.class === 'I' ? Color.NAMES.blue :
            th.spec.class === 'P' ? Color.NAMES.indigo :
            th.spec.class === 'K' ? Color.NAMES.violet :
            th.spec.class === 'O' ? Color.NAMES.gray :
            th.spec.class === 'D' ? Color.NAMES.brown :
            th.spec.class === 'S' ? Color.NAMES.magenta :
            Color.NAMES.white;
        return '#' + c.toString(16);
    }
</script>

<svg viewBox="{left} {top} {width} {height}" on:click={touchMap} bind:this={svg}>
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
    </defs>

    {#if svgBspBoxes}
        {#each map.nodes as n}
            <rect
                x={n.boundsLeft.left}
                y={n.boundsLeft.top}
                width={n.boundsLeft.right - n.boundsLeft.left}
                height={n.boundsLeft.bottom - n.boundsLeft.top}
                style="fill:blue;stroke:pink;stroke-width:5;fill-opacity:0.1;stroke-opacity:0.9"
            />
            <rect
                x={n.boundsRight.left}
                y={n.boundsRight.top}
                width={n.boundsRight.right - n.boundsRight.left}
                height={n.boundsRight.bottom - n.boundsRight.top}
                style="fill:green;stroke:pink;stroke-width:5;fill-opacity:0.1;stroke-opacity:0.9"
            />
        {/each}
    {/if}

    {#if svgSubSectors}
        {#each map.renderSectors as s, i}
            {@const c = namedColor(i)}
            <path class="subsector" d={subsegPath(s)} fill={"#" + c.toString(16)} on:click={() => clickSubsect(s)} />
            {#if s.vertexes.length === 2}
                <circle cx={s.vertexes[0].x} cy={s.vertexes[0].y} r="20" fill="yellow" on:click={() => clickSubsect(s)} />
            {/if}
            {#if selectedRs === s}
                {#each s.vertexes as v}
                    <circle cx={v.x} cy={v.y} r="10" fill="blue" />
                {/each}
                {#each s.bspLines as bp}
                    {@const p = planeFrom(bp[0], bp[1])}
                    <line x1={bp[0].x} y1={bp[0].y} x2={bp[1].x} y2={bp[1].y} stroke={'orange'} stroke-width={15}/>
                    <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={'orange'} stroke-width={2}/>
                {/each}
                {#each bspPoints(s.bspLines) as v}
                    <circle cx={v.x} cy={v.y} r="15" fill="green" on:click={() => evalPoint(v, s)} />
                {/each}
            {/if}
        {/each}
    {/if}

    {#each map.linedefs as ld}
        <line
            x1={ld.v1.x}
            y1={ld.v1.y}
            x2={ld.v2.x}
            y2={ld.v2.y}
            stroke={lineStroke(ld)}
            stroke-width={5}
            on:click={() => console.log(ld)}
        />
    {/each}

    {#if svgVertexes}
        {#each map.vertexes as v}
            <circle cx={v.x} cy={v.y} r="5" fill="blue" on:click={() => console.log(v)} />
        {/each}
    {/if}

    {#if svgStartSector}
        {#each map.linedefs.filter((ld) => ld.right.sector === sect) as ld}
            <line
                x1={ld.v1.x}
                y1={ld.v1.y}
                x2={ld.v2.x}
                y2={ld.v2.y}
                stroke={"magenta"}
                stroke-width={5}
            />
        {/each}
    {/if}

    {#if svgThings}
        {#each map.renderThings as th}
            <circle cx={th.source.x} cy={th.source.y} r={th.spec.mo.radius} stroke={thingColor(th)} stroke-width={3} />
            <line
                x1={th.source.x}
                y1={th.source.y}
                x2={th.spec.mo.radius * Math.cos(th.source.angle * ToRadians) + th.source.x}
                y2={th.spec.mo.radius * Math.sin(th.source.angle * ToRadians) + th.source.y}
                stroke={thingColor(th)}
                fill={thingColor(th)}
                marker-end="url(#arrow)"
                stroke-width={2}
            />
        {/each}

    {/if}
</svg>

<style>
    line:hover {
        stroke: red;
    }
    .subsector {
        opacity: 0.5;
    }
    .subsector:hover {
        opacity: 1;
        stroke: gold;
        stroke-dasharray: 2px;
        stroke-width: 8px;
        z-index: 10;
    }
    svg {
        /* invert top and bottom */
        transform: scaley(-1);
    }
</style>
