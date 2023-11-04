<script lang="ts">
    import { MapObjectIndex, type MapObject, type MapRuntime } from "../../doom";
    import { useDoomMap } from "../DoomContext";
    import BlockMap from "../Debug/BlockMap.svelte";
    import Stats from "../Debug/Stats.svelte";
    import EditorTagLink from "../Editor/EditorTagLink.svelte";
    import Flats from "./Flats.svelte";
    import Player from "./Player.svelte";
    import SkyBox from "./SkyBox.svelte";
    import Thing from "./Thing.svelte";
    import Wall from "./Wall.svelte";
    import WallHackTransparentDoor from "./WallHackTransparentDoor.svelte";

    export let map: MapRuntime;
    const { rev, erev } = map;
    const { renderSectors } = useDoomMap();

    let things: MapObject[] = [];
    $: if ($rev) {
        // don't render player here (it's in Player.svelte)
        things = map.objs.filter(e => e.type !== MapObjectIndex.MT_PLAYER);
    }
    let ethings: MapObject[] = [];
    $: if ($erev) {
        ethings = map.ephemeralObjs;
    }
    // TODO: to actually improve performance here, I think we'll have to implement some kind of PVS
    // based on the bsp tree https://cs.gmu.edu/~jchen/cs662/lecture5-2007.pdf

    // Why wrap certain sections in div? It reduces the cost of reflow from adding/removing DOM nodes.
    // From profiling data, we reduce reflow from 20% of the overall time to 1%. Also mark the divs
    // as position:absolute to hopefully help(?)
</script>

<Stats />

<SkyBox />

<BlockMap {map} />

{#each renderSectors as renderSector}
    <div>
        <Flats {renderSector} />
        {#each renderSector.linedefs as linedef}
            {#if linedef.transparentDoorHack}
                <WallHackTransparentDoor {linedef} />
            {:else}
                <Wall {renderSector} {linedef} />
            {/if}
        {/each}
    </div>
{/each}

<div>
    {#each things as thing (thing.id)}
        <Thing {thing} />
    {/each}
</div>
<div>
    {#each ethings as thing (thing.id)}
        <Thing {thing} />
    {/each}
</div>

<Player /> <!-- and camera... -->

<EditorTagLink {map} />

<style>
    div {
        position: absolute;
    }
</style>