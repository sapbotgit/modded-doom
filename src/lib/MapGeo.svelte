<script lang="ts">
    import type { DoomMap, MapObject } from "../doom";
    import Flats from "./Flats.svelte";
    import Wall from "./Wall.svelte";
    import Thing from "./Thing.svelte";
    import BlockMap from "./Debug/BlockMap.svelte";

    export let map: DoomMap;
    const { rev } = map;

    // don't render player here (it's in Player.svelte)
    let things: MapObject[] = [];
    $: if ($rev) {
        things = map.objs.filter(e => e.source.type !== 1);
    }
</script>

<BlockMap {map} />

{#each map.renderSectors as renderSector, i}
    <Flats {renderSector} index={i} />
    {#each renderSector.segs as seg}
        <Wall {seg} />
    {/each}
{/each}

{#each things as thing (thing.id)}
    <Thing {thing} />
{/each}
