<script lang="ts">
    import { Canvas, type ThrelteContext } from "@threlte/core";
    import type { DoomMap } from "../doom";
    import Stats from './Debug/Stats.svelte';
    import { onMount, setContext } from "svelte";
    import { createContext } from "./useDoom";
    import SkyBox from "./SkyBox.svelte";
    import EditPanel from "./Editor/EditPanel.svelte";
    import MapGeo from "./MapGeo.svelte";
    import { Object3D } from "three";
    import { pointerLockControls } from "./ZAxisPointerLock";
    import { Clock } from "three";
    import Player from "./Player.svelte";
    import PlayerInfo from "./Debug/PlayerInfo.svelte";
    import EditorTagLink from "./Editor/EditorTagLink.svelte";

    export let map: DoomMap;

    Object3D.DEFAULT_UP.set(0, 0, 1);

    const doomContext = createContext(map);
    setContext('doom-context', doomContext);
    const { game, settings, editor } = doomContext;
    const { mode: cameraMode } = game.camera;

    let clock = new Clock();
    let threlteCtx: ThrelteContext;
    onMount(() => {
        // highlight any special linedefs to help with debugging
        // const spec = [49,73,25,77,6,141,74,57,];
        // for (const linedef of map.linedefs) {
        //     if (spec.includes(linedef.special)) {
        //         $editor.selected = linedef
        //         console.log('special!!',linedef.special)
        //         break;
        //     }
        // }

        const interval = 1 / settings.targetFPS;
        let delta = 0;
        let frameDelta = 0;
        let frame: number;
        function update() {
            frame = requestAnimationFrame(update);
            const d = clock.getDelta();
            delta += d;
            frameDelta += d;

            if (frameDelta > interval) {
                threlteCtx.advance();
                game.tick(delta);
                delta = 0;
                frameDelta = frameDelta % interval
            }
        }
        update();
        return () => cancelAnimationFrame(frame);
    });

    let showPlayerInfo = false;
    const { freelook } = game.input;
</script>

<select bind:value={$cameraMode}>
    <option>bird</option>
    <option>1p</option>
    <option>3p</option>
</select>
<label>
    <input type="checkbox" bind:checked={game.input.noclip} />
    noclip
</label>
<label>
    <input type="checkbox" bind:checked={$freelook} />
    Free look
</label>
<label>
    <input type="checkbox" bind:checked={game.input.freeFly} />
    Free fly
</label>
<label>
    <input type="checkbox" bind:checked={$editor.active} on:change={() => $editor.selected = null} />
    Enable editing
</label>
<label>
    <input type="checkbox" bind:checked={showPlayerInfo} />
    Show player info
</label>

<div>
    <div use:pointerLockControls={{ game }}>
        <!-- <div id="lock-message">
            Controls: WASD
            <br>
            Click to lock
        </div> -->
        <Canvas size={{ width: 800, height: 600 }} frameloop='never' bind:ctx={threlteCtx}>
            <Stats />

            <SkyBox {map} />

            <MapGeo {map} />

            <Player />

            <EditorTagLink {map} />
        </Canvas>
    </div>

    <EditPanel {map} />
    {#if showPlayerInfo}
        <PlayerInfo player={game.player} />
    {/if}
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