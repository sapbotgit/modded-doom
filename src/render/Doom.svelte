<script lang="ts">
    import { randInt, type Game, randomNorm } from "../doom";
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
    import Menu from "./Menu/Menu.svelte";
    import TouchControls from "./Controls/TouchControls.svelte";
    import { keyboardCheatControls } from "./Controls/KeyboardCheatControls";
    import { Icon } from '@steeze-ui/svelte-icon'
    import { Bars3BottomLeft } from '@steeze-ui/heroicons'

    export let game: Game;

    const doomContext = createGameContext(game);
    setContext("doom-game-context", doomContext);
    const { urlHash, settings, audio, pointerLock } = useAppContext();
    const { cameraMode, musicVolume, soundVolume, muted, mainVolume, keymap, mouseSensitivity, mouseInvertY, mouseSwitchLeftRightButtons } = settings;
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
    $: mapMusicTrack = $map?.musicTrack;

    const mainGain = audio.createGain();
    mainGain.connect(audio.destination);
    $: mainGain.gain.value = $muted ? 0 : $mainVolume;

    const soundGain = audio.createGain();
    soundGain.connect(mainGain);
    $: soundGain.gain.value = $soundVolume * .1;

    const musicGain = audio.createGain();
    musicGain.connect(mainGain);
    $: musicGain.gain.value = $musicVolume;

    const { isPointerLocked, requestLock } = pointerLock;
    $: showMenu = !$isPointerLocked;

    // A fun little hack to make the game feel like it used to on my 486sx25
    const { simulate486, timescale, pixelScale, fpsLimit } = settings;
    let threlteCtx: ThrelteContext;
    // F5 low-res mode (it should be .5 but that looks to sharp IMO)
    // FIXME: starting the game with low pixel ratio and then increasing doesn't work... why?
    $: threlteCtx?.renderer?.setPixelRatio($simulate486 ? .2 : $pixelScale);
    let frameTime = 1 / $fpsLimit;
    let tscale = $timescale;
    $: if ($simulate486) {
        const set486Params = () => {
            if (!$simulate486) {
                frameTime = 1 / $fpsLimit;
                tscale = $timescale;
                return;
            }

            // a real 486 would slow down if there was a lot of geometry or bad guys but this was simple and fun.
            // This guy has some neat numbers though we're not strictly following it https://www.youtube.com/watch?v=rZcAo4oUc4o
            frameTime = 1 / randomNorm(2, 18, 1.2);
            // IIRC even game logic would slow down when the CPU was busy. We simulate that slowing down time (just a little)
            tscale = 1 - frameTime * 2;
            setTimeout(set486Params, randInt(200, 800));
        }
        set486Params();
    }

    // TODO: re-arrange Canvas component so we can use threlte's useTask() instead of svelte's onMount()
    // Also so we can use shaders to perform transitions?
    let viewSize = { width: 1024, height: 600 };
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

                game.tick(clock.elapsedTime - lastTickTime, tscale);
                lastTickTime = clock.elapsedTime;
            }
        }
        update();

        return () => cancelAnimationFrame(frameReq);
    });

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
    class="select-none overflow-hidden relative"
    bind:clientHeight={viewSize.height}
    bind:clientWidth={viewSize.width}
>
    <div class="game">
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
            <Canvas bind:ctx={threlteCtx} autoRender={false}>
                <MapRoot map={$map} />
            </Canvas>
            {/if}
            <HUD size={viewSize} player={$map.player} />

            <MusicPlayer {game} audioRoot={musicGain} trackName={$mapMusicTrack} />
            <SoundPlayer {game} player={$map.player} audioRoot={soundGain} />
        </MapContext>

        {#if !showMenu || $cameraMode === 'svg'}
        <div use:keyboardControls={{ input: game.input, keymap: $keymap }} />
        <div use:keyboardCheatControls={game} />
        {/if}
        {#if $isPointerLocked && !touchDevice}
        <div use:mouseControls={{ input: game.input, mouseSpeed: $mouseSensitivity, invertY: $mouseInvertY, swapButtons: $mouseSwitchLeftRightButtons }} />
        {/if}
        {#if touchDevice && !showMenu}
            <button class="absolute top-4 left-4 text-4xl" on:click={() => $isPointerLocked = false}>
                <Icon class="swap-on fill-current opacity-60" src={Bars3BottomLeft} theme='solid' size="3rem"/>
            </button>
            <TouchControls {viewSize} {game} player={$map?.player} />
        {/if}
    </div>

    {#if showMenu}
        <Menu {viewSize} {requestLock} />
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
</style>
