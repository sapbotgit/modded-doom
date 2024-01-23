<script lang="ts">
    import { data, type Game } from "../doom";
    import { onMount, setContext } from "svelte";
    import { createGameContext, useAppContext } from "./DoomContext";
    import EditPanel from "./Editor/EditPanel.svelte";
    import PlayerInfo from "./Debug/PlayerInfo.svelte";
    import { pointerLockControls } from "./PointerLockControls";
    import { buildRenderSectors } from "./RenderData";
    import { Canvas, type ThrelteContext } from "@threlte/core";
    import HUD from "./HUD/HUD.svelte";
    import MapRoot from "./Map/Root.svelte";
    import SvgMapRoot from "./Svg/Root.svelte";
    import MapContext from "./Map/Context.svelte";
    import { Clock } from "three";
    import Intermission from "./Intermission/Intermission.svelte";
    import { fade, fly } from "svelte/transition";
    import { keyboardControls } from "./KeyboardControls";
    import MapNamePic from "./Components/MapNamePic.svelte";
    import Picture from "./Components/Picture.svelte";
    import MusicPlayer from "./MusicPlayer.svelte";
    import SoundPlayer from "./SoundPlayer.svelte";
    import Menu from "./Menu.svelte";

    export let game: Game;

    const doomContext = createGameContext(game);
    setContext('doom-game-context', doomContext);
    const { url, settings, editor, audio } = useAppContext();
    const { cameraMode, musicVolume, soundVolume, mainVolume } = settings;
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
    let showMenu = true;

    let viewSize = { width: 1024, height: 600 };
    let threlteCtx: ThrelteContext;
    onMount(() => {
        const clock = new Clock();
        const interval = 1 / settings.targetFPS;
        let lastTickTime = 0;
        let frameDelta = 0;
        let frameReq: number;
        function update() {
            frameReq = requestAnimationFrame(update);
            frameDelta += clock.getDelta();
            if (frameDelta > interval) {
                threlteCtx?.advance();
                frameDelta = frameDelta % interval;

                game.tick(clock.elapsedTime - lastTickTime);
                lastTickTime = clock.elapsedTime;
            }
        }
        update();

        return () => cancelAnimationFrame(frameReq);
    });
</script>

<MapContext map={$map} {renderSectors}>
    <MusicPlayer gain={musicGain} musicBuffer={$map.musicBuffer} />
    <SoundPlayer {game} {player} gain={soundGain} />
</MapContext>

<!--
    TODO: we want the screen wipe!!
    interesting: https://www.shadertoy.com/view/XtlyDn
-->
<div
    class="select-none overflow-hidden"
    bind:clientHeight={viewSize.height}
    bind:clientWidth={viewSize.width}
>
    {#if $cameraMode === 'svg'}
        <div class="game" use:keyboardControls={game}>
            <MapContext map={$map} {renderSectors}>
                <SvgMapRoot size={viewSize} map={$map}
                    on:activate={() => showMenu = false}
                    on:deactivate={() => showMenu = true}
                />
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
            use:pointerLockControls={{ messageNode, input: game.input }}
            on:pointer-lock={() => showMenu = false}
            on:pointer-unlock={() => showMenu = true}
        >
            <MapContext map={$map} {renderSectors}>
                <Canvas frameloop='never' bind:ctx={threlteCtx}>
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

            {#if showMenu}
                <div
                    transition:fade
                    class="opacity-50 absolute inset-x-0 inset-y-0 bg-gradient-to-b from-primary to-neutral inset"
                    class:hidden={$editor.active}
                />
                <div
                    class="bg-base-100 absolute flex justify-center items-center gap-4 p-6 flex-col border-t-2 border-b-2 border-accent honeycomb"
                    class:w-screen={!$editor.active}
                    class:bottom-0={$editor.active}
                    transition:fly={{ y: 40 }}
                >
                    <!-- <Picture name="M_PAUSE" /> -->
                    <div class="flex gap-4 items-center" class:hidden={$editor.active}>
                        <button class="btn">
                            {#if $intermission}
                                Intermission
                            {:else}
                                <span><MapNamePic name={$map.name} /></span>
                            {/if}
                        </button>
                        <span><Picture name={data.skills.find(sk => sk.num === game.skill).pic} /></span>
                    </div>
                    {#if $map}
                    <div class="flex gap-4 items-center" class:hidden={$editor.active}>
                        <span class:text-primary={player.stats.kills >= $map.stats.totalKills}>Kills</span>
                        <div
                            class="radial-progress"
                            class:text-primary={player.stats.kills >= $map.stats.totalKills}
                            style="--value:{player.stats.kills/$map.stats.totalKills * 100};"
                            role="progressbar">{player.stats.kills} / {$map.stats.totalKills}</div>

                        <span class:text-primary={player.stats.items >= $map.stats.totalItems}>Items</span>
                        <div
                            class="radial-progress"
                            class:text-primary={player.stats.items >= $map.stats.totalItems}
                            style="--value:{player.stats.items/$map.stats.totalItems * 100};"
                            role="progressbar">{player.stats.items} / {$map.stats.totalItems}</div>

                            <span class:text-primary={player.stats.secrets >= $map.stats.totalSecrets}>Secrets</span>
                        <div
                            class="radial-progress"
                            class:text-primary={player.stats.secrets >= $map.stats.totalSecrets}
                            style="--value:{player.stats.secrets/$map.stats.totalSecrets * 100};"
                            role="progressbar">{player.stats.secrets} / {$map.stats.totalSecrets}</div>
                    </div>
                    {/if}
                    <button class="btn btn-wide btn-lg" bind:this={messageNode}>Click to play</button>
                    <span class="text-xs" class:hidden={$editor.active}>
                        Move: <kbd class="kbd">W</kbd><kbd class="kbd">A</kbd><kbd class="kbd">S</kbd><kbd class="kbd">D</kbd><br>
                        Use: <kbd class="kbd">E</kbd>; Weapons: <kbd class="kbd">1</kbd>-<kbd class="kbd">7</kbd><br>
                        Shoot: Left-click<br>
                        Run: <kbd class="kbd">Shift</kbd>
                    </span>
                </div>
            {/if}
        </div>
    {/if}

    {#if showMenu}
        <Menu />
    {/if}
    <MapContext map={$map} {renderSectors}>
        <PlayerInfo player={$map.player} interactive={showMenu} />
        <EditPanel map={$map} />
    </MapContext>
</div>

<style>
    .game {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        background: #242424;
    }
</style>