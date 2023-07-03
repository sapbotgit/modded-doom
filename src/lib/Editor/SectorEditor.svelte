<script lang="ts">
    import type { DoomMap, Sector } from "../../doomwad";
    import { useDoom } from "../useDoom";
    import TextureChooser from "./TextureChooser.svelte";

    export let map: DoomMap;
    export let sector: Sector;

    const { game } = useDoom();
    const { light, zCeil, zFloor, floorFlat, ceilFlat } = sector;

    let showSelector = false;
    function toggleSelector() {
        showSelector = !showSelector;
    }

    // https://doomwiki.org/wiki/Sector
    const types = [
        'Normal',
        'Blink random',
        'Blink 0.5 second',
        'Blink 1.0 second',
        '20% damage per second plus light blink 0.5 second',
        '10% damage per second',
        '5% damage per second',
        'Oscillates',
        'Player entering this sector gets credit for finding a secret',
        '30 seconds after level start, ceiling closes like a door',
        "20% damage per second. The level ends when the player's health drops below 11% and is touching the floor. Player health cannot drop below 1% while anywhere in a sector with this sector type.",
        'Blink 1.0 second, synchronized',
        'Blink 0.5 second, synchronized',
        '300 seconds after level start, ceiling opens like a door',
        '20% damage per second',
        'Flickers randomly',
    ];

    function changeType(n: number) {
        sector.type = n;
        showSelector = false;
        game.synchronizeActions();
    }
</script>

<h3>Sector</h3>
<div>
    <button on:click={toggleSelector}>{types[sector.type]}</button>
    {#if showSelector}
        <div class="selector">
            {#each types as t, i}
                <button on:click={() => changeType(i)}>{t}</button>
            {/each}
        </div>
    {/if}
</div>
<div>
    <label>
        <input type="range" min="0" max="255" step="8" bind:value={$light} />
        Light level {$light}
    </label>
</div>
<div>
    <!--
    TODO: we could actually do so much better here. Imagine something like:

    --| 70
      |
      |
      | height: 78
      |
      |
    --| -8

    Where we can drag top and bottom and buttons to help line up with neighbouring sectors

    There are lots of possibilities.
    -->
    <label>
        <input type="text" inputmode="numeric" pattern="[0-9]*" bind:value={$zCeil} />
        Ceiling height {$zCeil} (diff: {$zCeil - $zFloor}) (original {sector.source.zCeil})
    </label>
</div>
<div>
    <label>
        <input type="text" inputmode="numeric" pattern="[0-9]*" bind:value={$zFloor} />
        Floor height {$zFloor} (diff: {$zCeil - $zFloor}) (original {sector.source.zFloor})
    </label>
</div>
<div>
    <span>Ceiling</span>
    <TextureChooser wad={map.wad} type="flat" bind:value={$ceilFlat} />
</div>
<div>
    <span>Floor</span>
    <TextureChooser wad={map.wad} type="flat" bind:value={$floorFlat} />
</div>


<style>
    div {
        position: relative;
    }

    .selector {
        z-index: 1;
        overflow-y: scroll;
        max-height: 30em;
        position: absolute;
        display: flex;
        flex-direction: column;
    }
</style>