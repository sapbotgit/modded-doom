<script lang="ts">
    import { Canvas, OrthographicCamera, PerspectiveCamera, type Position, type ThrelteContext } from "@threlte/core";
    import type { DoomMap, DoomWad } from "../doomwad";
    import Stats from './Debug/Stats.svelte';
    import { onDestroy, onMount, setContext } from "svelte";
    import { createContext } from "./useDoom";
    import SkyBox from "./SkyBox.svelte";
    import EditPanel from "./Editor/EditPanel.svelte";
    import MapGeo from "./MapGeo.svelte";
    import { Object3D } from "three";
    import { pointerLockControls } from "./ZAxisPointerLock";
    import { Clock } from "three";

    export let wad: DoomWad;
    export let map: DoomMap;

    Object3D.DEFAULT_UP.set(0, 0, 1);

    const doomContext = createContext(map);
    setContext('doom-context', doomContext);
    const { game, settings } = doomContext;
    const {
        direction: playerDirection,
        position: playerPosition,
        pitch: playerPitch,
    } = game.player;

    function target(position: Position, direction: number, pitch: number) {
        const tx = 10 * Math.cos(direction) + position.x;
        const ty = 10 * Math.sin(direction) + position.y;
        const tz = 10 * Math.cos(pitch) + position.z;
        return { x: tx, y: ty, z: tz };
    }

    let clock = new Clock();
    let dispose = false;
    let threlteCtx: ThrelteContext;
    onMount(() => {
        const interval = 1 / settings.targetFPS;
        let delta = 0;
        function update() {
            if (!dispose) {
                requestAnimationFrame(update);
            }
            delta += clock.getDelta();

            if (delta > interval) {
                game.tick(delta);
                threlteCtx.advance();
                delta = delta % interval;
            }
        }
        update();
    })
    onDestroy(() => dispose = true);
</script>

<div use:pointerLockControls={{ game }}>
    <!-- <div id="lock-message">
        Controls: WASD
        <br>
        Click to lock
    </div> -->
    <Canvas size={{ width: 800, height: 600 }} frameloop='never' bind:ctx={threlteCtx}>
        <Stats />

        <!-- <OrthographicCamera
            lookAt={target($playerPosition, $playerDirection)}
            position={$playerPosition}
        /> -->
        <!-- lookAt={target($playerPosition, $playerDirection, $playerPitch)} -->
        <PerspectiveCamera
            rotation={{ z: $playerDirection, x: $playerPitch, order: 'ZXY' }}
            position={$playerPosition}
            far={100000}
            fov={70}
        />

        <SkyBox {map} />

        <MapGeo {map} />
    </Canvas>

    <EditPanel {map} />
</div>

<style>
    div {
        display: flex;
        flex-direction: row;
        position: relative;
    }

    #lock-message {
        background: rgba(.5,.5,.5,.5);
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
    }
</style>