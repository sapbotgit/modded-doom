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
    import { Clock, Vector3 } from "three";
    import Intermission from "./Intermission/Intermission.svelte";
    import { keyboardControls } from "./Controls/KeyboardControls";
    import { mouseControls } from "./Controls/MouseControls";
    import { touchMoveControls, touchLookControls, touchWeaponControls } from "./Controls/TouchControls";
    import MusicPlayer from "./MusicPlayer.svelte";
    import SoundPlayer from "./SoundPlayer.svelte";
    import Menu from "./Menu.svelte";

    export let game: Game;

    const doomContext = createGameContext(game);
    setContext("doom-game-context", doomContext);
    const { urlHash, settings, audio, pointerLock } = useAppContext();
    const { cameraMode, musicVolume, soundVolume, mainVolume, fpsLimit, pixelScale } = settings;
    const { map, intermission } = game;

    const touchDevice = matchMedia('(hover: none)').matches;
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
    // Also so we can use shaders to perform transitions?
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

    type Point = { x: number, y: number };
    let movePoint = { x: 0, y: 0 };
    let lookPoint = { x: 0, y: 0 };
    const touchPoint = (point: Point, ev: CustomEvent<Vector3>) => {
        point.x = (ev.detail.x + 1) * 50;
        point.y = (ev.detail.y + 1) * 50;
        return point;
    };

    // Someday I hope to live in a world where I can use fullscreen API in safari on iPhone
    // https://forums.developer.apple.com/forums/thread/133248
    // https://caniuse.com/fullscreen
    function scrollBottom() {
        setTimeout(() => window.scrollTo(0, 1), 50);
    }
</script>

<svelte:window on:load={scrollBottom} />

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
        {#if $isPointerLocked && !touchDevice}
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

    {#if touchDevice && !showMenu}
        <button class="absolute top-0 left-4 text-4xl" on:click={() => $isPointerLocked = false}>⛭</button>
        <div class="absolute bottom-16 px-4 w-full flex justify-between">
            <div
                use:touchMoveControls={game}
                on:touch-active={ev => movePoint = touchPoint(movePoint, ev)}
                style="--px:{movePoint.x}%; --py:{100 - movePoint.y}%"
                class="touchGradient w-40 h-40 rounded-full"
            />
            <div
                use:touchLookControls={game}
                on:touch-active={ev => lookPoint = touchPoint(lookPoint, ev)}
                style="--px:{lookPoint.x}%; --py:{lookPoint.y}%"
                class="touchGradient w-40 h-40 rounded-full"
            />
        </div>
    {/if}
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
        position: relative;
        display: grid;
        width: 100vw;
        height: 100vh;
        background: #242424;
    }

    .touchGradient {
        background-image: radial-gradient(
            circle at var(--px, '50%') var(--py, '50%'),
            oklch(var(--bc)), oklch(var(--bc)) 25%, transparent 30%);
        border: 1px solid black;
        opacity: .4;
    }
</style>
