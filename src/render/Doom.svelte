<script lang="ts">
    import type { Game } from "../doom";
    import { onMount, setContext } from "svelte";
    import { createContext } from "./DoomContext";
    import EditPanel from "./Editor/EditPanel.svelte";
    import { pointerLockControls } from "./PointerLockControls";
    import PlayerInfo from "./Debug/PlayerInfo.svelte";
    import { buildRenderSectors } from "./RenderData";
    import { Canvas, type ThrelteContext } from "@threlte/core";
    import HUD from "./HUD/HUD.svelte";
    import MapRoot from "./Map/Root.svelte";
    import MapContext from "./Map/Context.svelte";
    import { Clock } from "three";

    export let game: Game;

    const doomContext = createContext(game);
    setContext('doom-context', doomContext);
    const { settings, editor } = doomContext;
    const { map } = game;
    $: renderSectors = buildRenderSectors($map.data);

    let showPlayerInfo = false;
    const { wireframe, showBlockMap } = settings;
    const { freelook, noclip, freeFly, cameraMode, timescale } = game.settings;

    let clock = new Clock();
    let threlteCtx: ThrelteContext;
    onMount(() => {
        const interval = 1 / settings.targetFPS;
        let delta = 0;
        let frameDelta = 0;
        let frameReq: number;
        function update() {
            frameReq = requestAnimationFrame(update);
            const d = clock.getDelta();
            delta += d;
            frameDelta += d;
            if (frameDelta > interval) {
                threlteCtx.advance();
                game.tick(delta);
                delta = 0;
                frameDelta = frameDelta % interval;
            }
        }
        update();
        return () => cancelAnimationFrame(frameReq);
    });
</script>

<label>
    Camera
    <select bind:value={$cameraMode}>
        <option>bird</option>
        <option>ortho</option>
        <option>1p</option>
        <option>3p</option>
        <option>3p-noclip</option>
    </select>
</label>
<label>
    <input type="checkbox" bind:checked={$noclip} />
    noclip
</label>
<label>
    <input type="checkbox" bind:checked={$freelook} />
    Free look
</label>
<label>
    <input type="checkbox" bind:checked={$freeFly} />
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
<label>
    <input type="checkbox" bind:checked={$showBlockMap} />
    Show blockmap
</label>
<label style="width:6em; display:inline-block">
    <input style="width:100%" type="range" min={0.05} max={2} step={0.05} bind:value={$timescale} />
    Time ({$timescale})x
</label>
<label>
    Show geometry
    <select bind:value={$wireframe}>
        <option>none</option>
        <option>visible</option>
        <option>all</option>
    </select>
</label>

<div>
    <div class="game" use:pointerLockControls={game}>
        <!-- <div id="lock-message">
            Controls: WASD
            <br>
            Click to lock
        </div> -->

        <Canvas size={{ width: 1024, height: 600 }} frameloop='never' bind:ctx={threlteCtx}>
            <MapContext map={$map} {renderSectors}>
                <MapRoot map={$map} />
            </MapContext>
        </Canvas>
        {#if $map}
            {#key $map}
                <HUD player={$map.player} />
            {/key}
        {/if}
    </div>

    <MapContext map={$map} {renderSectors}>
        <EditPanel map={$map} />
    </MapContext>
    {#if showPlayerInfo}
        <PlayerInfo player={$map.player} />
    {/if}
</div>

<style>
    div {
        display: flex;
        flex-direction: row;
        position: relative;
    }

    .game {
        flex-direction: column;
    }

    #lock-message {
        background: rgba(.5,.5,.5,.5);
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
    }
</style>