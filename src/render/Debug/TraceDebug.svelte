<script lang="ts">
    import { Vector3 } from "three";

    const worldSize = 1050;
    const gridSize = 128;
    const numCols = Math.floor(worldSize * 2/gridSize);
    const numRows = Math.floor(worldSize * 2/gridSize);

    let gLines = [];
    for (let i = -worldSize; i < worldSize; i += gridSize) {
        gLines.push([new Vector3(-worldSize, i), new Vector3(worldSize, i)]);
        gLines.push([new Vector3(i, -worldSize), new Vector3(i, worldSize)]);
    }

    interface Step {
        x: number;
        y: number;
        tMaxX: number;
        tMaxY: number;
    }
    const createTrace = () => ({
        tMaxX0: 0,
        tMaxY0: 0,
        start: new Vector3(),
        move: new Vector3(),
        tDeltaX: 0,
        tDeltaY: 0,
        steps: [] as Step[],
    });
    let trace = createTrace();

    function traceRay(start: Vector3, move: Vector3) {
        const frac = (n: number) => (n % 1) + (n < 0 ? 1 : 0);

        trace = createTrace();
        let startX = (start.x - (-worldSize)) / gridSize;
        let startY = (start.y - (-worldSize)) / gridSize;
        let x = Math.floor(startX);
        let y = Math.floor(startY);
        const sx = Math.sign(move.x);
        const sy = Math.sign(move.y);
        if (sx === 0 && sy === 0) {
            return;
        }
        let tDeltaX = Math.abs(gridSize / move.x);
        let tDeltaY = Math.abs(gridSize / move.y);
        let tMaxX = tDeltaX * (move.x < 0 ? frac(startX) : 1 - frac(startX));
        let tMaxY = tDeltaY * (move.y < 0 ? frac(startY) : 1 - frac(startY));

        trace.tMaxX0 = tMaxX;
        trace.tMaxY0 = tMaxY;
        trace.tDeltaX = tDeltaX;
        trace.tDeltaY = tDeltaY;
        trace.start.copy(start);
        trace.move.copy(move);

        while (true) {
            const inBounds = x >= 0 && x <= numRows && y >= 0 && y <= numCols;
            if (!inBounds) {
                break;
            }
            trace.steps.push({ x, y, tMaxX, tMaxY });
            if (tMaxX > 1 && tMaxY > 1) {
                break;
            }
            if (tMaxX < tMaxY) {
                tMaxX = tMaxX + tDeltaX;
                x = x + sx;
            } else {
                tMaxY = tMaxY + tDeltaY;
                y = y + sy;
            }
        }


        // let x = Math.floor(start.x);
        // let y = Math.floor(start.y);

        // const dt_dx = gridSize / Math.abs(move.x);
        // const dt_dy = gridSize / Math.abs(move.y);

        // let n = 1;
        // let x_inc: number, y_inc: number;
        // let vNext: number, hNext: number;

        // if (move.x === 0) {
        //     x_inc = 0;
        //     hNext = dt_dx; // infinity
        // } else if (move.x > 0) {
        //     x_inc = gridSize;
        //     n += Math.floor(start.x + move.x) - x;
        //     hNext = (Math.floor(start.x) + 1 - start.x) * dt_dx;
        // } else {
        //     x_inc = -gridSize;
        //     n += x - Math.floor(start.x + move.x);
        //     hNext = (start.x - Math.floor(start.x)) * dt_dx;
        // }

        // if (move.y === 0) {
        //     y_inc = 0;
        //     vNext = dt_dy; // infinity
        // } else if (move.y > 0) {
        //     y_inc = gridSize;
        //     n += Math.floor(start.y + move.y) - y;
        //     vNext = (Math.floor(start.y) + 1 - start.y) * dt_dy;
        // } else {
        //     y_inc = -gridSize;
        //     n += y - Math.floor(start.y + move.y);
        //     vNext = (start.y - Math.floor(start.y)) * dt_dy;
        // }

        // for (; n > 0; --n) {
        //     let rx = Math.floor((x - (-worldSize)) / gridSize);
        //     let ry = Math.floor((y - (-worldSize)) / gridSize);
        //     const inBounds = rx >= 0 && rx <= numRows && ry >= 0 && ry <= numCols;
        //     if (!inBounds) {
        //         break;
        //     }
        //     trace.steps.push({ x: rx, y: ry, tMaxX:0, tMaxY:0 });

        //     if (vNext < hNext) {
        //         y += y_inc;
        //         vNext += dt_dy;
        //     } else {
        //         x += x_inc;
        //         hNext += dt_dx;
        //     }
        // }
    }

    let start = new Vector3();
    let move = new Vector3();
    let mouseDown = false;
    let svg: any;
    function mousedown(ev) {
        mouseDown = true;
        let p = new DOMPoint(ev.clientX, ev.clientY);
        let sp = p.matrixTransform(svg.getScreenCTM().inverse());
        start.set(sp.x, sp.y, 0);
        start = start;
        move.set(0, 0, 0);
        move = move;
    }
    function mouseup(ev) {
        mouseDown = false;
        traceRay(start, move);
    }
    function mousemove(ev) {
        if (!mouseDown) {
            return;
        }
        let p = new DOMPoint(ev.clientX, ev.clientY);
        let sp = p.matrixTransform(svg.getScreenCTM().inverse());
        move.set(sp.x, sp.y, 0).sub(start);
        move = move;
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<svg
    bind:this={svg}
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
            <rect x={-worldSize + step.x * gridSize} y={-worldSize + step.y * gridSize} width={gridSize} height={gridSize} fill={'red'} />
            <!-- <circle cx={-worldSize + (step.x + step.tMaxX) * gridSize} cy={-worldSize + (step.y + step.tMaxY) * gridSize} r={7} fill="cyan" /> -->
        {/each}


        <circle cx={trace.start.x} cy={trace.start.y} r={5} fill="yellow" />
        <circle cx={trace.start.x + trace.move.x} cy={trace.start.y + trace.move.y} r={5} fill="green" />
        <line x1={trace.start.x} y1={trace.start.y} x2={trace.start.x + trace.move.x} y2={trace.start.y + trace.move.y} stroke={'orange'} />
    </g>

    {#if mouseDown}
        <circle cx={start.x} cy={start.y} r={10} fill="yellow" />
        <circle cx={start.x + move.x} cy={start.y + move.y} r={10} fill="green" />
        <line x1={start.x} y1={start.y} x2={start.x + move.x} y2={start.y + move.y} stroke={'orange'} />
    {/if}
</svg>

<style>
</style>