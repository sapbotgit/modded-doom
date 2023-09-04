<script lang="ts">
    import type { Game } from "../doom";
    import { setContext } from "svelte";
    import { createContext } from "./DoomContext";
    import EditPanel from "./Editor/EditPanel.svelte";
    import MapGeo from "./MapGeo.svelte";
    import { pointerLockControls } from "./ZAxisPointerLock";
    import PlayerInfo from "./Debug/PlayerInfo.svelte";
    import { buildRenderSectors } from "./RenderData";

    export let game: Game;

    const doomContext = createContext(game);
    setContext('doom-context', doomContext);
    const { settings, editor } = doomContext;
    const { map } = game;

    $: setContext('doom-map', {
        map: $map,
        renderSectors: buildRenderSectors($map.data.nodes),
    });

    let showPlayerInfo = false;
    const { wireframe } = settings;
    const { freelook, noclip, freeFly, cameraMode, timescale } = game.settings;
</script>

<label>
    Camera
    <select bind:value={$cameraMode}>
        <option>bird</option>
        <option>ortho</option>
        <option>1p</option>
        <option>3p</option>
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
    {#key $map}
        <div class="game" use:pointerLockControls={game}>
            <!-- <div id="lock-message">
                Controls: WASD
                <br>
                Click to lock
            </div> -->
            <MapGeo map={$map} />
        </div>

        <EditPanel map={$map} />
        {#if showPlayerInfo}
            <PlayerInfo player={$map.player} />
        {/if}
    {/key}
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