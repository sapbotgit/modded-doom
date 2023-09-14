<script lang="ts">
    import { Vector3 } from "three";
    import { AmanatidesWooTrace, type Vertex } from "../../doom";

    const worldSize = 1050;
    const gridSize = 128;
    const numCols = Math.floor(worldSize * 2/gridSize);
    const numRows = Math.floor(worldSize * 2/gridSize);
    const boundsLeft = -worldSize;
    const boundsBottom = -worldSize;
    let radius = 96;
    $: rRadius = Math.max(radius, 1);

    let gLines = [];
    for (let i = -worldSize; i < worldSize; i += gridSize) {
        gLines.push([new Vector3(-worldSize, i), new Vector3(worldSize, i)]);
        gLines.push([new Vector3(i, -worldSize), new Vector3(i, worldSize)]);
    }

    let trace = {
        start: new Vector3(),
        move: new Vector3(),
        steps: [] as Vertex[],
    };

    const nwTrace = new AmanatidesWooTrace(-worldSize, -worldSize, gridSize, numRows, numCols);
    const neTrace = new AmanatidesWooTrace(-worldSize, -worldSize, gridSize, numRows, numCols);
    const seTrace = new AmanatidesWooTrace(-worldSize, -worldSize, gridSize, numRows, numCols);
    const swTrace = new AmanatidesWooTrace(-worldSize, -worldSize, gridSize, numRows, numCols);
    function traceRay4(start: Vector3, vel: Vector3, radius: number) {

        trace.steps = [];
        trace.start.copy(start);
        trace.move.copy(vel);

        const sx = Math.sign(vel.x);
        const sy = Math.sign(vel.y);
        const dx = sx === 0 ? 1 : sx;
        const dy = sy === 0 ? 1 : sy;

        let nw = nwTrace.init(start.x + radius * dx, start.y - radius * dy, vel);
        let ne = neTrace.init(start.x + radius * dx, start.y + radius * dy, vel);
        let se = seTrace.init(start.x - radius * dx, start.y + radius * dy, vel);
        let sw = swTrace.init(start.x - radius * dx, start.y - radius * dy, vel);

        let stepLen = -1;
        while (stepLen !== trace.steps.length) {
            stepLen = trace.steps.length;
            if (nw) trace.steps.push({ ...nw });
            if (ne) trace.steps.push({ ...ne });
            if (se) trace.steps.push({ ...se });
            if (sw) trace.steps.push({ ...sw });

            nw = nwTrace.step();
            ne = neTrace.step();
            se = seTrace.step();
            sw = swTrace.step();
        }
    }

    const rTrace = new AmanatidesWooTrace(-worldSize, -worldSize, gridSize, numRows, numCols);
    function traceRay3(start: Vector3, vel: Vector3, radius: number) {

        trace.steps = [];
        trace.start.copy(start);
        trace.move.copy(vel);

        const rScale = Math.floor(radius * 2 / gridSize);
        const sx = Math.sign(vel.x);
        const sy = Math.sign(vel.y);
        let vx = rTrace.init(start.x + radius * sx, start.y + radius * sy, vel);

        while (vx) {
            trace.steps.push({ ...vx });
            // trace x edge
            for (let i = -rScale; i < rScale; i++) {
                trace.steps.push({ x: vx.x + sx * i, y: vx.y });
            }
            // trace y edge
            for (let i = -rScale; i < rScale; i++) {
                trace.steps.push({ x: vx.x, y: vx.y + sy * i });
            }

            vx = rTrace.step();
        }
    }

    const mTrace = new AmanatidesWooTrace(-worldSize, -worldSize, gridSize, numRows, numCols);
    const ccwTrace = new AmanatidesWooTrace(-worldSize, -worldSize, gridSize, numRows, numCols);
    const cwTrace = new AmanatidesWooTrace(-worldSize, -worldSize, gridSize, numRows, numCols);
    function traceRay(start: Vector3, vel: Vector3, radius: number) {
        trace.steps = [];
        trace.start.copy(start);
        trace.move.copy(vel);

        // if sx or sy is 0 (vertical/horizontal line) we still need to find leading corners so choose a value
        const dx = vel.x ? Math.sign(vel.x) : 1;
        const dy = vel.y ? Math.sign(vel.y) : 1;
        // choose the three leading corners of the AABB based on vel and radius and trace those simultaneously.
        let ccw = ccwTrace.init(start.x + radius * dx, start.y - radius * dy, vel);
        let mid = mTrace.init(start.x + radius * dx, start.y + radius * dy, vel);
        let cw = cwTrace.init(start.x - radius * dx, start.y + radius * dy, vel);

        while (mid) {
            if (mid) trace.steps.push({ ...mid });
            if (ccw) trace.steps.push({ ...ccw });
            if (cw) trace.steps.push({ ...cw });

            if (ccw && mid) {
                // fill in the gaps between ccw and mid corners
                for (let i = Math.min(ccw.x, mid.x); i < Math.max(mid.x, ccw.x); i += 1) {
                    trace.steps.push({ x: i, y: mid.y });
                }
                for (let i = Math.min(ccw.y, mid.y); i < Math.max(mid.y, ccw.y); i += 1) {
                    trace.steps.push({ x: mid.x, y: i });
                }
            }
            if (cw && mid) {
                // fill in the gaps between mid and cw corners
                for (let i = Math.min(cw.x, mid.x); i < Math.max(mid.x, cw.x); i += 1) {
                    trace.steps.push({ x: i, y: mid.y });
                }
                for (let i = Math.min(cw.y, mid.y); i < Math.max(mid.y, cw.y); i += 1) {
                    trace.steps.push({ x: mid.x, y: i });
                }
            }

            ccw = ccwTrace.step() ?? ccw;
            mid = mTrace.step();
            cw = cwTrace.step() ?? cw;
        }
    }

    function sleep(time: number) {
        return new Promise(resolve => setTimeout(resolve, time));
    }
    async function traceRay1(start: Vector3, vel: Vector3, radius: number) {
        const frac = (n: number) => (n % 1) + (n < 0 ? 1 : 0);

        const sx = Math.sign(vel.x);
        const sy = Math.sign(vel.y);
        if (sx === 0 && sy === 0) {
            return;
        }

        let rx = sx === 0 ? -1 : sx;
        let ry = sy === 0 ? -1 : sy;
        const tDeltaX = Math.abs(gridSize / vel.x);
        const tDeltaY = Math.abs(gridSize / vel.y);
        const rScale = Math.floor(radius * 2 / gridSize);
        const leadX = start.x + (sx === 0 ? 1 : sx) * radius;
        const leadY = start.y + (sy === 0 ? 1 : sy) * radius;
        const startX = (leadX - boundsLeft) / gridSize;
        const startY = (leadY - boundsBottom) / gridSize;
        let tMaxX = tDeltaX * (vel.x < 0 ? frac(startX) : 1 - frac(startX));
        let tMaxY = tDeltaY * (vel.y < 0 ? frac(startY) : 1 - frac(startY));
        let x = Math.floor(startX);
        let y = Math.floor(startY);

        trace.steps = [];
        trace.start.copy(start);
        trace.move.copy(vel);

        while (true) {
            const inBounds = x >= 0 && x <= numRows && y >= 0 && y <= numCols;
            if (!inBounds) {
                break;
            }
            trace.steps.push({ x, y });
            // await sleep(1000);
            trace.steps = trace.steps;
            // trace y edge
            for (let i = -rScale; i < rScale; i++) {
                trace.steps.push({ y: y + ry * i, x });
            }
            // trace x edge
            for (let i = -rScale; i < rScale; i++) {
                trace.steps.push({ x: x + rx * i, y });
            }

            if (tMaxX > 1 && tMaxY > 1) {
                break;
            }

            if (tMaxX < tMaxY) {
                // // trace y edge
                // for (let i = -rScale; i < rScale; i++) {
                //     trace.steps.push({ y: y - ry * i, x });
                // }
                // await sleep(1000);

                trace.steps = trace.steps;
                tMaxX = tMaxX + tDeltaX;
                x = x + sx;
            } else {
                // // trace x edge
                // for (let i = -rScale; i < rScale; i++) {
                //     trace.steps.push({ x: x - rx * i, y });
                // }
                // await sleep(1000);
                // trace.steps = trace.steps;
                // for (let i = -rScale; i < rScale; i++) {
                //     trace.steps.push({ x, y: y + i * sy });
                // }
                tMaxY = tMaxY + tDeltaY;
                y = y + sy;
            }
        }
    }

    function simpleTrace(start: Vector3, vel: Vector3) {
        trace.steps = [];
        trace.start.copy(start);
        trace.move.copy(vel);

        let coords = rTrace.init(start.x, start.y, vel);
        while (coords) {
            trace.steps.push({ y: coords.y, x: coords.x });
            coords = rTrace.step();
        }
    }

    let start = new Vector3();
    let move = new Vector3();
    let mouseDown = false;
    function mousedown(ev) {
        mouseDown = true;
        let p = new DOMPoint(ev.clientX, ev.clientY);
        let sp = p.matrixTransform(ev.target.getScreenCTM().inverse());
        start.set(sp.x, sp.y, 0);
        start = start;
        move.set(0, 0, 0);
        move = move;
    }
    function mouseup(ev) {
        mouseDown = false;
        traceRay(start, move, radius);
        // simpleTrace(start, move);
    }
    function mousemove(ev) {
        if (!mouseDown) {
            return;
        }
        let p = new DOMPoint(ev.clientX, ev.clientY);
        let sp = p.matrixTransform(ev.target.getScreenCTM().inverse());
        move.set(sp.x, sp.y, 0).sub(start);
        move = move;
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
BlockMap Trace
Radius {radius.toFixed(2)}px <input type="range" step={gridSize / 12} min="0" max={gridSize * 2} bind:value={radius} />
<svg
    viewBox={`-${worldSize} -${worldSize} ${worldSize * 2} ${worldSize * 2}`}
    on:mousedown={mousedown}
    on:mouseup={mouseup}
    on:mousemove={mousemove}
>
    {#each gLines as line}
        <line x1={line[0].x} y1={line[0].y} x2={line[1].x} y2={line[1].y} stroke={'orange'} />
    {/each}

    <!-- last trace info -->
    <g opacity={0.7}>
        {#each trace.steps as step}
            <rect x={-worldSize + step.x * gridSize} y={-worldSize + step.y * gridSize} width={gridSize} height={gridSize} opacity={0.3} fill={'red'} />
        {/each}

        <rect x={trace.start.x - rRadius} y={trace.start.y - rRadius} width={rRadius * 2} height={rRadius * 2} stroke-width={3} stroke="yellow" fill={'none'} />
        <rect x={trace.start.x + trace.move.x - rRadius} y={trace.start.y + trace.move.y - rRadius} width={rRadius * 2} height={rRadius * 2} stroke-width={3} stroke="green" fill={'none'} />

        <line x1={trace.start.x - radius} y1={trace.start.y - radius} x2={trace.start.x + trace.move.x - radius} y2={trace.start.y + trace.move.y - radius} stroke-width={2} stroke={'orange'} />
        <line x1={trace.start.x + radius} y1={trace.start.y - radius} x2={trace.start.x + trace.move.x + radius} y2={trace.start.y + trace.move.y - radius} stroke-width={2} stroke={'orange'} />
        <line x1={trace.start.x - radius} y1={trace.start.y + radius} x2={trace.start.x + trace.move.x - radius} y2={trace.start.y + trace.move.y + radius} stroke-width={2} stroke={'orange'} />
        <line x1={trace.start.x + radius} y1={trace.start.y + radius} x2={trace.start.x + trace.move.x + radius} y2={trace.start.y + trace.move.y + radius} stroke-width={2} stroke={'orange'} />
    </g>

    {#if mouseDown}
        <rect x={start.x - rRadius} y={start.y - rRadius} width={rRadius * 2} height={rRadius * 2} stroke-width={3} stroke="yellow" fill={'none'} />
        <rect x={start.x + move.x - rRadius} y={start.y + move.y - rRadius} width={rRadius * 2} height={rRadius * 2} stroke-width={3} stroke="green" fill={'none'} />
        <line x1={start.x - radius} y1={start.y - radius} x2={start.x + move.x - radius} y2={start.y + move.y - radius} stroke-width={2} stroke={'orange'} />
        <line x1={start.x + radius} y1={start.y - radius} x2={start.x + move.x + radius} y2={start.y + move.y - radius} stroke-width={2} stroke={'orange'} />
        <line x1={start.x - radius} y1={start.y + radius} x2={start.x + move.x - radius} y2={start.y + move.y + radius} stroke-width={2} stroke={'orange'} />
        <line x1={start.x + radius} y1={start.y + radius} x2={start.x + move.x + radius} y2={start.y + move.y + radius} stroke-width={2} stroke={'orange'} />
    {/if}
</svg>

<style>
</style>