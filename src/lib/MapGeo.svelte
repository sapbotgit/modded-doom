<script lang="ts">
    import type { DoomMap } from "../doom";
    import Flats from "./Flats.svelte";
    import Wall from "./Wall.svelte";
    import Thing from "./Thing.svelte";
    import BlockMap from "./Debug/BlockMap.svelte";

    export let map: DoomMap;
    // don't render player here (it's in Player.svelte)
    $: things = map.objs.filter(e => e.source.type !== 1);
</script>

<BlockMap {map} />

{#each map.renderSectors as renderSector, i}
    <Flats {renderSector} index={i} />
    {#each renderSector.segs as seg}
        <Wall {seg} />
    {/each}
{/each}

{#each things as thing}
    {#key thing}
        <Thing {thing} />
    {/key}
{/each}
