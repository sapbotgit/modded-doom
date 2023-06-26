<script lang="ts">
    import {
        Canvas,
        AmbientLight,
        PerspectiveCamera,
    } from "@threlte/core";

    import { MapTextures } from './Texture';
    import type { DoomMap, DoomWad, Thing } from "../doomwad";
    import Stats from './Debug/Stats.svelte';
    import Wall from './Wall.svelte';
    import Flats from './Flats.svelte';
    import { onDestroy, setContext } from "svelte";
    import { DoomGame } from "../doom-game";
    import type { DoomContext } from "./useDoom";
    import FirstPersonControls from "./FirstPersonControls.svelte";
    export let wad: DoomWad;
    export let map: DoomMap;

    // let int = setInterval(
    //     () => {
    //         const idx = Math.floor(Math.random() * map.renderSectors.length);
    //         const sec = map.renderSectors[idx].sector;
    //         // sec.zCeil.update(n => n += (Math.random() * 5) - 10)
    //         // sec.light.set(Math.trunc(Math.random() * 255));
    //     }, 100);
    // onDestroy(() => clearInterval(int));

    const playerHeight = 41;

    $: p1 = map.things.find(e => e.type === 1);
    $: zFloor = map.findSector(p1.x, p1.y).zFloor;
    $: pZHeight = playerHeight + $zFloor;

    const position = (p1: Thing) => ({ x: p1.x, y: pZHeight, z: -p1.y });

    function target(p1: Thing) {
        const angRad = p1.angle * Math.PI / 180;
        const tx = 10 * Math.cos(angRad) + p1.x;
        const tz = 10 * -Math.sin(angRad) - p1.y;
        return { x: tx, y: pZHeight, z: tz };
    }

    $: if (map) {
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

    <PerspectiveCamera lookAt={target(p1)} position={position(p1)} far={100000} fov={70}>
        <FirstPersonControls {map} />
    </PerspectiveCamera>

    <!-- <DirectionalLight shadow color={'white'} position={{ x: -15, y: 45, z: 20 }} intensity={0.5} />
    <DirectionalLight shadow color={'white'} position={{ x: -15, y: -45, z: 20 }} intensity={0.5} /> -->
    <!-- <HemisphereLight skyColor={'white'} groundColor={'white'} intensity={.8} /> -->
    <AmbientLight color={'white'} intensity={0.4} />

    {#each map.linedefs as linedef}
        <Wall {linedef} />
    {/each}

    {#each map.renderSectors as renderSector, i}
        <Flats {renderSector} index={i} />
    {/each}
</Canvas>
