<script lang="ts">
    import type { Vertex } from "../../doomwad";
    import { intersectionPoint, signedLineDistance } from "../Math";

    let intersect: Vertex;
    let p = { x: 80, y: 80 };
    let l1 = [{ x: 10, y: 10}, { x:50, y: 50 }];
    let l2 = [{ x: 50, y: 10}, { x:20, y: 60 }];
    $: if (l1 && l2) {
        intersect = intersectionPoint(l1, l2);
    }

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
    <circle cx={l1[1].x} cy={l1[1].y} r="2" fill="blue" use:dragPoint={l1[1]} />
    <circle cx={l2[0].x} cy={l2[0].y} r="2" fill="blue" use:dragPoint={l2[0]} />
    <circle cx={l2[1].x} cy={l2[1].y} r="2" fill="blue" use:dragPoint={l2[1]} />

    {#if intersect}
        <circle cx={intersect.x} cy={intersect.y} r="2" fill="red" use:dragPoint={l2[1]} />
    {/if}
</svg>