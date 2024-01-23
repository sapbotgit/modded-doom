<script lang="ts">
    import { fly } from "svelte/transition";
    import { useAppContext } from "./DoomContext";

    const { settings, editor } = useAppContext();
    const { freelook, noclip, zAimAssist, freeFly, cameraMode, timescale, wireframe, showBlockMap, useTextures, monsterAI, maxLostSouls, musicPlayback, musicVolume, soundVolume, mainVolume, experimentalSoundHacks } = settings;
</script>

<div
    class="settings bg-base-100 shadow-xl honeycomb"
    in:fly={{ x: -200, delay: 400 }}
    out:fly={{ x: -200 }}
>
    <div class="divider">Settings</div>
    <label class="label">
        <span class="label-text">Overall volume {$mainVolume}</span>
        <input type="range" class="range range-primary" min={0} max={1} step={.1} bind:value={$mainVolume} />
    </label>
    <label class="label">
        <span class="label-text">Sound volume {$soundVolume}</span>
        <input type="range" class="range" min={0} max={1} step={.1} bind:value={$soundVolume} />
    </label>
    <label class="label">
        <span class="label-text">Music volume {$musicVolume}</span>
        <input type="range" class="range" min={0} max={1} step={.1} bind:value={$musicVolume} />
    </label>
    <label class="label">
        <span class="label-text">Music</span>
        <select class="select w-full max-w-xs" bind:value={$musicPlayback}>
            <option>synth</option>
            <option>soundfont</option>
            <option>off</option>
        </select>
    </label>
    <label class="label">
        <span class="label-text">Camera</span>
        <select class="select w-full max-w-xs" bind:value={$cameraMode}>
            <option>bird</option>
            <option>ortho</option>
            <option>1p</option>
            <option>3p</option>
            <option>3p-noclip</option>
            <option>svg</option>
        </select>
    </label>

    <div class="divider">Advanced</div>
    <label class="label cursor-pointer">
        <span class="label-text">Auto Z-Aim</span>
        <input type="checkbox" class="checkbox" bind:checked={$zAimAssist} />
    </label>
    <label class="label cursor-pointer">
        <span class="label-text">noclip</span>
        <input type="checkbox" class="checkbox" bind:checked={$noclip} />
    </label>
    <label class="label cursor-pointer">
        <span class="label-text">Free look</span>
        <input type="checkbox" class="checkbox" bind:checked={$freelook} />
    </label>
    <label class="label cursor-pointer">
        <span class="label-text">Free fly</span>
        <input type="checkbox" class="checkbox" bind:checked={$freeFly} />
    </label>
    <label class="label cursor-pointer">
        <span class="label-text">Inspector</span>
        <input type="checkbox" class="checkbox" bind:checked={$editor.active} on:change={() => $editor.selected = null} />
    </label>
    <label class="label cursor-pointer">
        <span class="label-text">Show blockmap</span>
        <input type="checkbox" class="checkbox" bind:checked={$showBlockMap} />
    </label>
    <label class="label cursor-pointer">
        <span class="label-text">Show textures</span>
        <input type="checkbox" class="checkbox" bind:checked={$useTextures} />
    </label>
    <label class="label">
        <span class="label-text">Timescale ({$timescale})x</span>
        <input type="range" class="range" min={0.1} max={2} step={0.1} bind:value={$timescale} />
    </label>
    <label class="label">
        <span class="label-text">AI Mode</span>
        <select class="select w-full max-w-xs" bind:value={$monsterAI}>
            <option>enabled</option>
            <option>disabled</option>
            <option>move-only</option>
            <option>fast</option>
        </select>
    </label>
    <label class="label">
        <span class="label-text">Show geometry</span>
        <select class="select w-full max-w-xs" bind:value={$wireframe}>
            <option>none</option>
            <option>visible</option>
            <option>all</option>
        </select>
    </label>
    <label class="label">
        <input type="range" class="range" min={0} max={50} step={5} bind:value={$maxLostSouls} />
        <span class="label-text">Max Lost Souls: {$maxLostSouls === 0 ? '∞' : $maxLostSouls}</span>
    </label>
    <label class="label cursor-pointer">
        <span class="label-text">Room acoustics (experimental)</span>
        <input type="checkbox" class="checkbox" bind:checked={$experimentalSoundHacks} />
    </label>
</div>

<style>
    .settings {
        position: absolute;
        left: 0;
        top: 0;

        text-align: left;
        padding: 1em;
        font-size: .9em;
        gap: .5em;
        display: flex;
        flex-direction: column;
        overflow-y: scroll;
        min-width: 20em;
        max-height: 100vh;
        /* display: none; */
    }
</style>
