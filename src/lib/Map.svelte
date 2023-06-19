<script lang="ts">
    import { PlaneGeometry, MeshBasicMaterial, MeshStandardMaterial, DoubleSide, BackSide, Path } from 'three'
    import {
      DirectionalLight,
      HemisphereLight,
      Mesh,
      OrbitControls,
      PerspectiveCamera,
      OrthographicCamera,
      Canvas,
      type Rotation,

      type Position

    } from "@threlte/core";

    import type { DoomMap, DoomWad, LineDef, Sector, Thing, SubSector, TreeNode } from "../doomwad";
    import FirstPersonControls from './FirstPersonControls.svelte';
    export let wad: DoomWad;
    export let map: DoomMap;

    const svgDraw = false;
    const svgStartSector = true;
    const svgBspBoxes = false;
    const svgVertexes = false;

    let sect: Sector;
    const playerHeight = 41;
    const padding = 40;
    let pZHeight = 0;
    let p1: Thing = null;
    let target: Position = {};
    let left = 0;
    let top = 0;
    let width = 0;
    let height = 0;
    $: if (map.vertexes) {
        p1 = map.things.find(e => e.type === 1);
        const angRad = p1.angle * Math.PI / 180;
        const tx = 10 * Math.cos(angRad) + p1.x;
        const tz = 10 * -Math.sin(angRad) - p1.y;
        sect = map.findSector(p1.x, p1.y)
        pZHeight = playerHeight + sect.zFloor;
        target = { x: tx, y: pZHeight, z: tz };

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

    type MeshProps = { rotation: Rotation, position: Position, geometry: PlaneGeometry };
    function meshProps(ld: LineDef, height: number, top: number, flip: boolean = false): MeshProps {
        const vx = ld.v2.x - ld.v1.x;
        const vy = ld.v2.y - ld.v1.y;
        const width = Math.sqrt(vx * vx + vy * vy);
        const geometry =  new PlaneGeometry(width, height)

        const x = (ld.v1.x + ld.v2.x) * .5;
        const y = top - height * .5;
        const z = -(ld.v1.y + ld.v2.y) * .5;
        const position = { x, y, z };

        const invlen = 1 / width;
        const offset = flip ? Math.PI : 0;
        const rotation = { y: Math.atan2(vy * invlen, vx * invlen) + offset};

        return { rotation, position, geometry };
    }

    function meshes(ld: LineDef) {
        let geos: MeshProps[] = [];
        // TODO: middle section for two-sided sidedefs?
        if (ld.left) {
            if (ld.left.sector.zFloor !== ld.right.sector.zFloor) {
                const height = Math.abs(ld.left.sector.zFloor - ld.right.sector.zFloor);
                const top = Math.max(ld.right.sector.zFloor, ld.left.sector.zFloor);
                geos.push(meshProps(ld, height, top, ld.left.sector.zFloor < ld.right.sector.zFloor));
            }
            if (ld.left.sector.zCeil !== ld.right.sector.zCeil) {
                const height = Math.abs(ld.left.sector.zCeil - ld.right.sector.zCeil);
                const top = Math.max(ld.right.sector.zCeil, ld.left.sector.zCeil);
                geos.push(meshProps(ld, height, top, ld.left.sector.zCeil > ld.right.sector.zCeil));
            }
        } else {
            const height = ld.right.sector.zCeil - ld.right.sector.zFloor;
            const top = ld.right.sector.zCeil;
            geos.push(meshProps(ld, height, top));
        }
        return geos;
    }

    function lineStroke(ld: LineDef) {
        return !ld.left ? wad.palettes[0][176] :
            (ld.left.sector.zFloor !== ld.right.sector.zFloor) ? wad.palettes[0][64] :
            (ld.left.sector.zCeil !== ld.right.sector.zCeil) ?  wad.palettes[0][231] :
            wad.palettes[0][96];
    }
</script>

<div>{map.name}</div>

{#if svgDraw}
    <svg viewBox="{left} {top} {width} {height}">
        {#each map.linedefs as ld}
            <line
            x1={ld.v1.x} y1={ld.v1.y} x2={ld.v2.x} y2={ld.v2.y} stroke={lineStroke(ld)} stroke-width={5}
            on:click={() => console.log(ld)}
            />
        {/each}

        {#if svgVertexes}
            {#each map.vertexes as v}
                <circle cx={v.x} cy={v.y} r="10" stroke="blue"/>
            {/each}
        {/if}

        {#if svgStartSector}
            {#each map.linedefs.filter(ld => ld.right.sector === sect) as ld}
                <line x1={ld.v1.x} y1={ld.v1.y} x2={ld.v2.x} y2={ld.v2.y} stroke={'magenta'} stroke-width={5} />
            {/each}
        {/if}

        {#if svgBspBoxes}
            {#each map.nodes as n}
                <rect x={n.boundsLeft.left} y={n.boundsLeft.top} width={n.boundsLeft.right - n.boundsLeft.left} height={n.boundsLeft.bottom - n.boundsLeft.top} style="fill:blue;stroke:pink;stroke-width:5;fill-opacity:0.1;stroke-opacity:0.9" />
                <rect x={n.boundsRight.left} y={n.boundsRight.top} width={n.boundsRight.right - n.boundsRight.left} height={n.boundsRight.bottom - n.boundsRight.top} style="fill:green;stroke:pink;stroke-width:5;fill-opacity:0.1;stroke-opacity:0.9" />
            {/each}
        {/if}
    </svg>
{/if}

<Canvas size={{ width: 800, height: 600 }}>
    <PerspectiveCamera lookAt={target} position={{ x: p1.x, y: pZHeight, z: -p1.y }} far={100000} fov={70}>
        <FirstPersonControls {map} />
        <!-- <OrbitControls {target} /> -->
    </PerspectiveCamera>

    <DirectionalLight shadow color={'white'} position={{ x: -15, y: 45, z: 20 }} />
    <HemisphereLight skyColor={'white'} groundColor={'#ac844c'} intensity={0.4} />

    {#each map.linedefs as ld}
        {#each meshes(ld) as mesh}
            <Mesh
                position={mesh.position}
                rotation={mesh.rotation}
                geometry={mesh.geometry}
                material={new MeshStandardMaterial({ color: lineStroke(ld) })}
            />
        {/each}
    {/each}
</Canvas>


<style>
    line:hover{
        stroke:red;
    }
    svg {
        /* invert top and bottom */
        transform: scaley(-1);
    }
</style>