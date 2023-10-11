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
    import SvgMapRoot from "./Svg/Root.svelte";
    import MapContext from "./Map/Context.svelte";
    import { Clock } from "three";
    import Intermission from "./Intermission/Intermission.svelte";
    import { fly } from "svelte/transition";
    import { keyboardControls } from "./KeyboardControls";

    export let game: Game;

    const doomContext = createContext(game);
    setContext('doom-context', doomContext);
    const { settings, editor } = doomContext;
    const { map, intermission } = game;
    $: renderSectors = $map ? buildRenderSectors($map.data) : [];
    $: game.settings.compassMove.set($cameraMode === 'svg');

    let messageNode: HTMLElement;
    let pointerLocked = false;

    let showPlayerInfo = false;
    const { wireframe, showBlockMap } = settings;
    const { freelook, noclip, freeFly, cameraMode, timescale } = game.settings;

    let viewSize = { width: 1024, height: 600 };
    let threlteCtx: ThrelteContext;
    onMount(() => {
        const clock = new Clock();
        const interval = 1 / settings.targetFPS;
        let lastFrameTime = 0;
        let frameDelta = 0;
        let frameReq: number;
        function update() {
            frameReq = requestAnimationFrame(update);
            frameDelta += clock.getDelta();
            if (frameDelta > interval) {
                threlteCtx?.advance();
                frameDelta = frameDelta % interval;

                game.tick(clock.elapsedTime - lastFrameTime);
                lastFrameTime = clock.elapsedTime;
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
        <option>svg</option>
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
    Editing
</label>
<label>
    <input type="checkbox" bind:checked={showPlayerInfo} />
    Player debug
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
    {#if $cameraMode === 'svg'}
        <div use:keyboardControls={game}>
            <MapContext map={$map} {renderSectors}>
                <SvgMapRoot size={viewSize} map={$map} />
                <HUD size={viewSize} player={$map.player} />
            </MapContext>
            {#if $intermission}
                {#key $intermission}
                    <Intermission size={viewSize} details={$intermission} />
                {/key}
            {/if}
        </div>
    {:else}
        <div class="game"
            class:small-lock-message={$editor.active}
            use:pointerLockControls={{ ...game, messageNode }}
            on:pointer-lock={() => pointerLocked = true}
            on:pointer-unlock={() => pointerLocked = false}
        >
            <!--
                TODO: we want the screen wipe!!
                interesting: https://www.shadertoy.com/view/XtlyDn
            -->
            <MapContext map={$map} {renderSectors}>
                <Canvas size={viewSize} frameloop='never' bind:ctx={threlteCtx}>
                    <MapRoot map={$map} />
                </Canvas>
                <HUD size={viewSize} player={$map.player} />
            </MapContext>
            {#if $intermission}
                {#key $intermission}
                    <Intermission size={viewSize} details={$intermission} />
                {/key}
            {/if}

            {#if !pointerLocked}
                <div class="lock-message" transition:fly={{ y: -40 }}>
                    <button bind:this={messageNode}>Click to play</button>
                    <span class="controls">
                        Move: WASD,
                        Use: E,
                        Shoot: Left-click,
                        <br>
                        Run: Shift,
                        Weapons: 1-7
                    </span>
                </div>
            {/if}
        </div>
    {/if}

    <MapContext map={$map} {renderSectors}>
        <EditPanel map={$map} />
        {#if showPlayerInfo}
            <PlayerInfo player={$map.player} />
        {/if}
    </MapContext>
</div>

<style>
    div {
        display: flex;
        flex-direction: row;
        position: relative;
        justify-content: center;
        align-content: center;
    }

    .game {
        flex-direction: column;
    }

    .controls {
        font-size: .7em;
    }

    .lock-message {
        background: rgba(.5,.5,.5,.5);
        padding: 1em 0;
        position: absolute;
        left: 0;
        right: 0;
        font-size: 2em;
        border-top: 2px solid grey;
        border-bottom: 2px solid grey;
        flex-direction: column;
        align-items: center;
    }

    .lock-message button {
        max-width: 15em;
    }

    .small-lock-message {
        justify-content: flex-end;
    }
    .small-lock-message .lock-message {
        padding: 2em;
        right: unset;
        font-size: 1em;
    }
</style>