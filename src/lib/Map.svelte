<script lang="ts">
    import { Canvas, OrthographicCamera, PerspectiveCamera, type Position, type ThrelteContext } from "@threlte/core";
    import type { DoomMap } from "../doomwad";
    import Stats from './Debug/Stats.svelte';
    import { onMount, setContext } from "svelte";
    import { createContext } from "./useDoom";
    import SkyBox from "./SkyBox.svelte";
    import EditPanel from "./Editor/EditPanel.svelte";
    import MapGeo from "./MapGeo.svelte";
    import { Object3D } from "three";
    import { pointerLockControls } from "./ZAxisPointerLock";
    import { Clock } from "three";

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

    let clock = new Clock();
    let threlteCtx: ThrelteContext;
    onMount(() => {
        const interval = 1 / settings.targetFPS;
        let delta = 0;
        let frame: number;
        function update() {
            frame = requestAnimationFrame(update);
            delta += clock.getDelta();

            if (delta > interval) {
                game.tick(delta);
                threlteCtx.advance();
                delta = 0;
            }
        }
        update();
        return () => cancelAnimationFrame(frame);
    });
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