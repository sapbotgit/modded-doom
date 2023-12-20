<script lang="ts">
    import { data, type Game } from "../doom";
    import { onMount, setContext } from "svelte";
    import { createGameContext, useAppContext } from "./DoomContext";
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
    import MapNamePic from "./Components/MapNamePic.svelte";
    import Picture from "./Components/Picture.svelte";
    import MusicPlayer from "./MusicPlayer.svelte";
    import SoundPlayer from "./SoundPlayer.svelte";

    export let game: Game;

    const doomContext = createGameContext(game);
    setContext('doom-game-context', doomContext);
    const { url, settings, editor, audio } = useAppContext();
    const { map, intermission } = game;
    $: player = $map?.player;
    $: renderSectors = $map ? buildRenderSectors(game.wad, $map) : [];
    $: settings.compassMove.set($cameraMode === 'svg');

    const mainGain = audio.createGain();
    mainGain.connect(audio.destination);
    $: mainGain.gain.value = $mainVolume;

    const soundGain = audio.createGain();
    soundGain.connect(mainGain);
    $: soundGain.gain.value = $soundVolume;

    const musicGain = audio.createGain();
    musicGain.connect(mainGain);
    $: musicGain.gain.value = $musicVolume;

    $: if ($map) {
        // keep url in sync with game
        $url = `/${game.wad.name}/skill${game.skill}/${$map.name}`;
    }

    let messageNode: HTMLElement;
    let pointerLocked = false;

    let showPlayerInfo = false;
    const { freelook, noclip, zAimAssist, freeFly, cameraMode, timescale, wireframe, showBlockMap, useTextures, monsterAI, maxLostSouls, musicPlayback, musicVolume, soundVolume, mainVolume } = settings;

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

<div class="settings">
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
        <input type="checkbox" bind:checked={$zAimAssist} />
        Auto Z-Aim
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
        Inspector
    </label>
    <label>
        <input type="checkbox" bind:checked={showPlayerInfo} />
        Player debug
    </label>
    <label>
        <input type="checkbox" bind:checked={$showBlockMap} />
        Show blockmap
    </label>
    <label>
        <input type="checkbox" bind:checked={$useTextures} />
        Show textures
    </label>
    <label style="width:6em; display:inline-block">
        <input style="width:100%" type="range" min={0.05} max={2} step={0.05} bind:value={$timescale} />
        Time ({$timescale})x
    </label>
    <label>
        AI Mode
        <select bind:value={$monsterAI}>
            <option>enabled</option>
            <option>disabled</option>
            <option>move-only</option>
            <option>fast</option>
        </select>
    </label>
    <label>
        Show geometry
        <select bind:value={$wireframe}>
            <option>none</option>
            <option>visible</option>
            <option>all</option>
        </select>
    </label>
    <label style="width:6em; display:inline-block">
        <input style="width:100%" type="range" min={0} max={50} step={5} bind:value={$maxLostSouls} />
        Max Lost Souls: {$maxLostSouls === 0 ? '∞' : $maxLostSouls}
    </label>
    <label>
        Music
        <select bind:value={$musicPlayback}>
            <option>synth</option>
            <option>soundfont</option>
            <option>off</option>
        </select>
    </label>
    <label style="width:6em; display:inline-block">
        <input style="width:100%" type="range" min={0} max={1} step={.1} bind:value={$musicVolume} />
        Music Volume {$musicVolume}
    </label>
    <label style="width:6em; display:inline-block">
        <input style="width:100%" type="range" min={0} max={1} step={.1} bind:value={$soundVolume} />
        Sound Volume {$soundVolume}
    </label>
    <label style="width:6em; display:inline-block">
        <input style="width:100%" type="range" min={0} max={1} step={.1} bind:value={$mainVolume} />
        Volume {$mainVolume}
    </label>
</div>

<div>
    {#if $cameraMode === 'svg'}
        <div use:keyboardControls={game}>
            <MapContext map={$map} {renderSectors}>
                <SvgMapRoot size={viewSize} map={$map} />
                <HUD size={viewSize} player={$map.player} />
            </MapContext>
            {#if $intermission}
                {#key $intermission}
                    <Intermission
                        {musicGain} {soundGain}
                        size={viewSize} details={$intermission} />
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
                    <Intermission
                        {musicGain} {soundGain}
                        size={viewSize} details={$intermission} />
                {/key}
            {/if}

            {#if !pointerLocked}
                <div class="lock-message" transition:fly={{ y: -40 }}>
                    <div class="map-status">
                        {#if $map}
                            <div class="map-stats">
                                <span>Kills</span><span>{player.stats.kills}</span><span>{$map.stats.totalKills}</span>
                                <span>Items</span><span>{player.stats.items}</span><span>{$map.stats.totalItems}</span>
                                <span>Secrets</span><span>{player.stats.secrets}</span><span>{$map.stats.totalSecrets}</span>
                            </div>
                        {/if}
                        <button>
                            {#if $intermission}
                                Intermission
                            {:else}
                                <span><MapNamePic name={$map.name} /></span>
                            {/if}
                        </button>
                        <span><Picture name={data.skills.find(sk => sk.num === game.skill).pic} /></span>
                    </div>
                    <button class="ctp" bind:this={messageNode}>Click to play</button>
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
        <MusicPlayer gain={musicGain} musicBuffer={$map.musicBuffer} />
        <SoundPlayer gain={soundGain} />
        <EditPanel map={$map} />
        {#if showPlayerInfo}
            <PlayerInfo player={$map.player} />
        {/if}
    </MapContext>
</div>

<style>
    div {
        user-select: none;

        display: flex;
        flex-direction: row;
        position: relative;
        justify-content: center;
        align-content: center;
    }

    .settings {
        font-size: .9m;
        gap: .5em;
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
        gap: 1em;
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
        font-size: .5em;
    }
    .lock-message .ctp {
        font-size: 1em;
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

    .small-lock-message .map-status {
        display: none;
    }
    .map-status {
        flex-direction: row;
        gap: 1em;
    }

    .map-stats {
        display: grid;
        font-size: .5em;
        grid-template-columns: 1fr 1fr 1fr;
    }
</style>