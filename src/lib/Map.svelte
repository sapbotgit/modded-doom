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

    import type { DoomMap, DoomWad, LineDef, Sector } from "../doomwad";
    import FirstPersonControls from './FirstPersonControls.svelte';
    export let wad: DoomWad;
    export let map: DoomMap;

    const padding = 40;
    let left = 0;
    let top = 0;
    let width = 0;
    let height = 0;
    $: if (map.vertexes) {
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

    function planeGeometry(ld: LineDef, height: number): PlaneGeometry {
        let lx = Math.abs(ld.v2.x - ld.v1.x);
        let ly = Math.abs(ld.v2.y - ld.v1.y);
        let width = Math.sqrt(lx * lx + ly * ly);
        return new PlaneGeometry(width, height);
    }

    function planeRotation(ld: LineDef, flip = false): Rotation {
        let vx = ld.v2.x - ld.v1.x;
        let vy = ld.v2.y - ld.v1.y;
        let invlen = 1 / Math.sqrt(vx * vx + vy * vy);
        let offset = flip ? Math.PI : 0;
        return { y: Math.atan2(vy * invlen, vx * invlen) + offset};
    }

    function planePosition(ld: LineDef, y: number): Position {
        const x = (ld.v1.x + ld.v2.x) * .5;
        const z = -(ld.v1.y + ld.v2.y) * .5;
        return { x, y, z };
    }

    function meshes(ld: LineDef) {
        type Geo = { rotation: Rotation, position: Position, geometry: PlaneGeometry };
        let geos: Geo[] = [];
        if (ld.left) {
            if (ld.left.sector.zFloor !== ld.right.sector.zFloor) {
                height = Math.abs(ld.left.sector.zFloor - ld.right.sector.zFloor);
                const geometry = planeGeometry(ld, height);
                const position = planePosition(ld, Math.max(ld.right.sector.zFloor, ld.left.sector.zFloor) - height * .5);
                const rotation = planeRotation(ld, ld.left.sector.zFloor < ld.right.sector.zFloor);
                geos.push({ rotation, position, geometry });
            }
            if (ld.left.sector.zCeil !== ld.right.sector.zCeil) {
                height = Math.abs(ld.left.sector.zCeil - ld.right.sector.zCeil);
                const geometry = planeGeometry(ld, height);
                const position = planePosition(ld, Math.max(ld.right.sector.zCeil, ld.left.sector.zCeil) - height * .5);
                const rotation = planeRotation(ld, ld.left.sector.zCeil > ld.right.sector.zCeil);
                geos.push({ rotation, position, geometry });
            }
        } else {
            height = ld.right.sector.zCeil - ld.right.sector.zFloor;
            const geometry = planeGeometry(ld, height);
            const position = planePosition(ld, ld.right.sector.zCeil - height * .5);
            const rotation = planeRotation(ld);
            geos.push({ rotation, position, geometry });
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
<!--
<svg viewBox="{left} {top} {width} {height}">
    {#each map.linedefs as ld}
        <line
        x1={ld.v1.x} y1={ld.v1.y} x2={ld.v2.x} y2={ld.v2.y} stroke={lineStroke(ld)} stroke-width={5}
        on:click={() => console.log(ld)}
        />
    {/each}
    {#each map.vertexes as v}
        <circle cx={v.x} cy={v.y} r="10" stroke="blue"/>
    {/each}
</svg>
-->

<Canvas size={{ width: 800, height: 600 }}>
    <PerspectiveCamera position={{ z: 10000 }} far={100000}>
        <!-- <FirstPersonControls /> -->
        <OrbitControls />
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