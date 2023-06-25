<script lang="ts">
    import {
        DirectionalLight,
        HemisphereLight,
        PerspectiveCamera,
        Canvas,
        type Position,
    } from "@threlte/core";

    import { MapTextures } from './Texture';
    import type { DoomMap, DoomWad, LineDef, RenderSector, Sector, Thing } from "../doomwad";
    import FirstPersonControls from './FirstPersonControls.svelte';
    import Stats from './Debug/Stats.svelte';
    import Wall from './Wall.svelte';
    import Flats from './Flats.svelte';
    import { onDestroy, setContext } from "svelte";
    import { DoomGame } from "../doom-game";
    import type { DoomContext } from "./useDoom";
    export let wad: DoomWad;
    export let map: DoomMap;

    let sect: Sector;
    const playerHeight = 41;
    let pZHeight = 0;
    let linedefs: LineDef[];
    let sectors: RenderSector[];
    let p1: Thing = null;
    let target: Position = {};
    $: if (map.vertexes) {
        linedefs = map.linedefs;
        sectors = map.renderSectors;
        p1 = map.things.find(e => e.type === 1);
        const angRad = p1.angle * Math.PI / 180;
        const tx = 10 * Math.cos(angRad) + p1.x;
        const tz = 10 * -Math.sin(angRad) - p1.y;
        sect = map.findSector(p1.x, p1.y)
        pZHeight = playerHeight + sect.zFloor;
        target = { x: tx, y: pZHeight, z: tz };

        // create context
        const game = new DoomGame();
        const textures = new MapTextures(wad);
        const settings = {
            useTextures: true,
        };

        setContext<DoomContext>('doom-context', { textures, game, wad, settings });
        onDestroy(() => game.dispose());
    }
</script>

<Canvas size={{ width: 800, height: 600 }}>
    <Stats />

    <PerspectiveCamera lookAt={target} position={{ x: p1.x, y: pZHeight, z: -p1.y }} far={100000} fov={70}>
        <FirstPersonControls {map} />
    </PerspectiveCamera>

    <DirectionalLight shadow color={'white'} position={{ x: -15, y: 45, z: 20 }} intensity={0.5} />
    <DirectionalLight shadow color={'white'} position={{ x: -15, y: -45, z: 20 }} intensity={0.5} />
    <HemisphereLight skyColor={'white'} groundColor={'#ac844c'} intensity={0.4} />

    {#each linedefs as linedef}
        <Wall {linedef} />
    {/each}

    {#each sectors as renderSector, i}
        <Flats {renderSector} index={i} />
    {/each}
</Canvas>
