<script lang="ts">
    import { type Game } from "../doom";
    import { onMount, setContext } from "svelte";
    import { createGameContext, useAppContext } from "./DoomContext";
    import EditPanel from "./Editor/EditPanel.svelte";
    import PlayerInfo from "./Debug/PlayerInfo.svelte";
    import { buildRenderSectors } from "./RenderData";
    import { Canvas, type ThrelteContext } from "@threlte/core";
    import HUD from "./HUD/HUD.svelte";
    import MapRoot from "./Map/Root.svelte";
    import SvgMapRoot from "./Svg/Root.svelte";
    import MapContext from "./Map/Context.svelte";
    import { Clock } from "three";
    import Intermission from "./Intermission/Intermission.svelte";
    import { keyboardControls } from "./Controls/KeyboardControls";
    import { mouseControls } from "./Controls/MouseControls";
    import MusicPlayer from "./MusicPlayer.svelte";
    import SoundPlayer from "./SoundPlayer.svelte";
    import Menu from "./Menu.svelte";

    export let game: Game;

    const doomContext = createGameContext(game);
    setContext("doom-game-context", doomContext);
    const { urlHash, settings, audio, pointerLock } = useAppContext();
    const { cameraMode, musicVolume, soundVolume, mainVolume, fpsLimit, pixelScale } = settings;
    const { map, intermission } = game;

    $: renderSectors = $map ? buildRenderSectors(game.wad, $map) : [];
    $: settings.compassMove.set($cameraMode === "svg");
    // keep url in sync with game
    $: if ($map) {
        $urlHash = `#${game.wad.name}&skill=${game.skill}&map=${$map.name}`;

        // Test intermission screens
        // $map.triggerSpecial({ special: 52 } as any, $map.player, 'W')
    }

    const mainGain = audio.createGain();
    mainGain.connect(audio.destination);
    $: mainGain.gain.value = $mainVolume;

    const soundGain = audio.createGain();
    soundGain.connect(mainGain);
    $: soundGain.gain.value = $soundVolume;

    const musicGain = audio.createGain();
    musicGain.connect(mainGain);
    $: musicGain.gain.value = $musicVolume;

    const { isPointerLocked, requestLock } = pointerLock;
    $: showMenu = !$isPointerLocked;

    // TODO: re-arrange Canvas component so we can use threlte's useTask() instead of svelte's onMount()
    $: frameTime = 1 / $fpsLimit;
    let viewSize = { width: 1024, height: 600 };
    let threlteCtx: ThrelteContext;
    onMount(() => {
        const clock = new Clock();
        let lastTickTime = 0;
        let frameDelta = 0;
        let frameReq: number;
        function update() {
            frameReq = requestAnimationFrame(update);
            frameDelta += clock.getDelta();
            if (frameDelta > frameTime) {
                threlteCtx?.invalidate();
                frameDelta = frameDelta % frameTime;

                game.tick(clock.elapsedTime - lastTickTime);
                lastTickTime = clock.elapsedTime;
            }
        }
        update();

        return () => cancelAnimationFrame(frameReq);
    });
</script>

<!--
    TODO: we want the screen wipe!!
    interesting: https://www.shadertoy.com/view/XtlyDn
-->
<div
    class="select-none overflow-hidden"
    bind:clientHeight={viewSize.height}
    bind:clientWidth={viewSize.width}
>
    <div class="game">
        {#if !showMenu || $cameraMode === 'svg'}
        <div use:keyboardControls={game} />
        {/if}
        {#if $isPointerLocked}
        <div use:mouseControls={game} />
        {/if}

        {#if $intermission}
            {#key $intermission}
                <Intermission
                    {musicGain}
                    {soundGain}
                    size={viewSize}
                    details={$intermission}
                />
            {/key}
        {/if}

        <MapContext map={$map} {renderSectors}>
            {#if $cameraMode === 'svg'}
            <SvgMapRoot
                size={viewSize}
                map={$map}
                on:activate={() => (showMenu = false)}
                on:deactivate={() => (showMenu = true)}
            />
            {:else}
            <Canvas bind:ctx={threlteCtx} autoRender={false} dpr={$pixelScale}>
                <MapRoot map={$map} />
            </Canvas>
            {/if}
            <HUD size={viewSize} player={$map.player} />

            <MusicPlayer gain={musicGain} musicBuffer={$map.musicBuffer} />
            <SoundPlayer {game} player={$map.player} gain={soundGain} />
        </MapContext>
    </div>

    {#if showMenu}
        <Menu player={$map?.player} {requestLock} />
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
        background: #242424;
    }
</style>
