<script lang="ts">
    import { Vector2, Vector3 } from "three";
    import type { Vertex } from "../../doomwad";
    import { lineLineIntersect, lineCircleIntersect, signedLineDistance, lineCircleSweep } from "../Math";

    let p = { x: 80, y: 80 };
    let l1 = [{ x: 10, y: 10}, { x:50, y: 50 }];
    let l2 = [{ x: 10, y: 40}, { x:70, y: 40 }];
    $: intersect = lineLineIntersect(l1, l2);

    let circ = { x: 80, y: 80 };
    let cvel = { x: 20, y: -20 };
    let r = 8;
    $: circleIntersect = lineCircleIntersect(l2, circ, r);
    $: cw2 = lineCircleSweep(l2, cvel, circ, r);
    $: cw1 = null//lineCircleSweep(l1, cvel, circ, r);
    $: proj = new Vector3(l2[1].x-l2[0].x, l2[1].y-l2[0].y,0 ).projectOnVector(new Vector3(l1[1].x-l1[0].x, l1[1].y-l1[0].y, 0))

    function dragPoint(node: SVGElement, v: Vertex) {
        let moveStart = { x:0, y:0 };
        const move = ev => {
            let dx = ev.screenX - moveStart.x;
            let dy = ev.screenY - moveStart.y;
            moveStart.x = ev.screenX;
            moveStart.y = ev.screenY;
            v.x += dx;
            v.y += dy;
            // hack to get dom reacting
            l1 = l1;
            l2 = l2;
            p = p;
            cvel = cvel;
            circ = circ;
        }
        const down = (ev) => {
            moveStart.x = ev.screenX;
            moveStart.y = ev.screenY;
            document.addEventListener('pointermove', move)
        }
        const up = (ev) => {
            document.removeEventListener('pointermove', move);
        }

        node.addEventListener('pointerdown', down);
        document.addEventListener('pointerup', up);
        return {
            destroy() {
                node.removeEventListener('pointerdown', down);
                document.removeEventListener('pointerup', up);
            }
        };
    }
</script>

<div>{signedLineDistance(l1, p)}</div>

<svg viewBox="0 0 100 100">
    <line x1={(l1[0].x + l1[1].x) * .5} y1={(l1[0].y + l1[1].y) * .5} x2={p.x} y2={p.y} stroke={'magenta'} />
    <line x1={l1[0].x} y1={l1[0].y} x2={l1[1].x} y2={l1[1].y} stroke={'orange'} />
    <line x1={l2[0].x} y1={l2[0].y} x2={l2[1].x} y2={l2[1].y} stroke={'green'} />

    <circle cx={p.x} cy={p.y} r="2" fill="yellow" use:dragPoint={p} />
    <circle cx={l1[0].x} cy={l1[0].y} r="2" fill="blue" use:dragPoint={l1[0]} />
    <circle cx={l1[1].x} cy={l1[1].y} r="2" fill="lightblue" use:dragPoint={l1[1]} />
    <circle cx={l2[0].x} cy={l2[0].y} r="2" fill="blue" use:dragPoint={l2[0]} />
    <circle cx={l2[1].x} cy={l2[1].y} r="2" fill="lightblue" use:dragPoint={l2[1]} />

    {#if intersect}
        <circle cx={intersect.x} cy={intersect.y} r="2" fill="red" use:dragPoint={l2[1]} />
    {/if}

    <line x1={l2[0].x} y1={l2[0].y} x2={l2[0].x + proj.x} y2={l2[0].y + proj.y} stroke-width={0.2} stroke={'cyan'} />
</svg>

<div>{JSON.stringify(circleIntersect)}</div>
<svg viewBox="0 0 100 100">
    <circle cx={circ.x} cy={circ.y} r={r} fill="yellow" use:dragPoint={circ} />
    {#if cw1}
        <circle cx={cw1.x} cy={cw1.y} r={r} stroke-width={0.7} stroke="orange" fill='transparent' pointer-events='none' />
        <!-- <line x1={l2[0].x} y1={l2[0].y} x2={l2[0].x + cw1.cn.x * 5} y2={l2[0].y + cw1.cn.y * 5} stroke-width={0.5} stroke={'orange'} />
        <line x1={l2[1].x} y1={l2[1].y} x2={l2[1].x + cw1.cn.x * 5} y2={l2[1].y + cw1.cn.y * 5} stroke-width={0.5} stroke={'orange'} />
        <line x1={l2[0].x} y1={l2[0].y} x2={l2[0].x + cw1.n.x * r} y2={l2[0].y + cw1.n.y * r} stroke-width={0.5} stroke={'cyan'} />
        <line x1={l2[1].x} y1={l2[1].y} x2={l2[1].x + cw1.n.x * r} y2={l2[1].y + cw1.n.y * r} stroke-width={0.5} stroke={'cyan'} />
        <line x1={cw1.x} y1={cw1.y} x2={cw1.x + cw1.dn.x * 5} y2={cw1.y + cw1.dn.y * 5} stroke-width={2} stroke={'purple'} /> -->
    {/if}
    {#if cw2}
        <circle cx={cw2.x} cy={cw2.y} r={r} stroke-width={0.4} stroke="green" fill='transparent' pointer-events='none' />
    {/if}

    {#if circleIntersect}
        {#each circleIntersect as p}
            <circle cx={p.x} cy={p.y} r="2" fill="red" />
        {/each}
    {/if}


    <line x1={l1[0].x} y1={l1[0].y} x2={l1[1].x} y2={l1[1].y} stroke={'orange'} />
    <line x1={l2[0].x} y1={l2[0].y} x2={l2[1].x} y2={l2[1].y} stroke={'green'} />
    <line x1={circ.x} y1={circ.y} x2={circ.x + cvel.x} y2={circ.y + cvel.y} stroke={'blue'} />
    <circle cx={circ.x + cvel.x} cy={circ.y + cvel.y} r="2" fill="pink" use:dragPoint={cvel} />

    <!-- {#if cw2}
        <line x1={cw2.edgeL.x} y1={cw2.edgeL.y} x2={cw2.edgeL.x + cvel.x} y2={cw2.edgeL.y + cvel.y} stroke={'green'} />
        <line x1={cw2.edgeR.x} y1={cw2.edgeR.y} x2={cw2.edgeR.x + cvel.x} y2={cw2.edgeR.y + cvel.y} stroke={'lightgreen'} />
    {/if} -->
    <!-- {#if cw1}
        <circle cx={cw1.a.x} cy={cw1.a.y} r={0.4} stroke-width={0.2} stroke="red" />
        <circle cx={cw1.b.x} cy={cw1.b.y} r={0.4} stroke-width={0.2} stroke="orange" />
        <circle cx={cw1.c.x} cy={cw1.c.y} r={0.4} stroke-width={0.2} stroke="yellow" />
        <circle cx={cw1.d.x} cy={cw1.d.y} r={0.4} stroke-width={0.2} stroke="green" />
    {/if} -->
</svg>