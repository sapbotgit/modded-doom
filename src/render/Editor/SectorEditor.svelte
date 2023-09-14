<script lang="ts">
    import type { MapRuntime, Sector } from "../../doom";
    import { useDoom } from "../DoomContext";
    import NumberChooser from "./NumberChooser.svelte";
    import TextureChooser from "./TextureChooser.svelte";

    export let map: MapRuntime;
    export let sector: Sector;

    const { editor, wad } = useDoom();
    const { light, zCeil, zFloor, floorFlat, ceilFlat } = sector;

    let showSelector = false;
    function toggleSelector() {
        showSelector = !showSelector;
    }

    // https://doomwiki.org/wiki/Sector
    const types = {
        0: 'Normal',
        1: 'Blink random',
        2: 'Blink 0.5 second',
        3: 'Blink 1.0 second',
        4: '20% damage per second plus light blink 0.5 second',
        5: '10% damage per second',
        7: '5% damage per second',
        8: 'Oscillates',
        9: 'Player entering this sector gets credit for finding a secret',
        10: '30 seconds after level start, ceiling closes like a door',
        11: "20% damage per second. The level ends when the player's health drops below 11% and is touching the floor. Player health cannot drop below 1% while anywhere in a sector with this sector type.",
        12: 'Blink 1.0 second, synchronized',
        13: 'Blink 0.5 second, synchronized',
        14: '300 seconds after level start, ceiling opens like a door',
        16: '20% damage per second',
        17: 'Flickers randomly',
    };

    function changeType(n: number) {
        sector.type = n;
        showSelector = false;
        map.synchronizeActions();
    }

    function tagLinedef() {
        $editor.selected = map.data.linedefs.find(e => e.tag === sector.tag)
    }

    function changeSector(ev) {
        const sector = map.data.sectors.find(e => e.num === ev.detail)
        if (sector) {
            $editor.selected = sector;
        }
    }
</script>

<h3>Sector <NumberChooser num={sector.num} on:select={changeSector} /></h3>
<div>
    <button on:click={tagLinedef}>Tag: {sector.tag}</button>
</div>
<div>
    <button on:click={toggleSelector}>{types[sector.type]}</button>
    {#if showSelector}
        <div class="selector">
            {#each Object.keys(types) as t, i}
                <button on:click={() => changeType(i)}>{types[t]}</button>
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
        Ceiling height {$zCeil} (diff: {$zCeil - $zFloor}) (original {sector.zCeil.initial})
    </label>
</div>
<div>
    <label>
        <input type="text" inputmode="numeric" pattern="[0-9]*" bind:value={$zFloor} />
        Floor height {$zFloor} (diff: {$zCeil - $zFloor}) (original {sector.zFloor.initial})
    </label>
</div>
<div>
    <div>Ceiling</div>
    <TextureChooser {wad} type="flat" bind:value={$ceilFlat} on:change={() => map.initializeTextureAnimation(ceilFlat, 'flat')} />
</div>
<div>
    <div>Floor</div>
    <TextureChooser {wad} type="flat" bind:value={$floorFlat} on:change={() => map.initializeTextureAnimation(floorFlat, 'flat')} />
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