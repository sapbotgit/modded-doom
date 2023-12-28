<script lang="ts">
    import { fly } from "svelte/transition";
    import { useAppContext } from "./DoomContext";

    const { settings, editor } = useAppContext();
    const { freelook, noclip, zAimAssist, freeFly, cameraMode, timescale, wireframe, showBlockMap, useTextures, monsterAI, maxLostSouls, musicPlayback, musicVolume, soundVolume, mainVolume, experimentalSoundHacks } = settings;
</script>

<div
    class="settings"
    in:fly={{ x: -200, delay: 400 }}
    out:fly={{ x: -200 }}
>
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
        <input style="width:100%" type="range" min={0} max={50} step={5} bind:value={$maxLostSouls}
        />Max Lost Souls: {$maxLostSouls === 0 ? '∞' : $maxLostSouls}
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
    <label>
        <input type="checkbox" bind:checked={$experimentalSoundHacks} />
        Experimental Room Acoustics
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
        background: #242424;
        overflow-y: scroll;
        min-width: 20em;
        max-height: 100vh;
        /* display: none; */
    }
</style>
