<script lang="ts">
    import type { DoomMap, MapObject } from "../doomwad";
    import Flats from "./Flats.svelte";
    import Wall from "./Wall.svelte";
    import Thing from "./Thing.svelte";

    export let map: DoomMap;

    // https://doomwiki.org/wiki/Thing_types#Other
    const invisibleThingTypes = [1, 2, 3, 4, 11, 14, 87, 88, 89];
    function isVisible(thing: MapObject) {
        if (thing.source.flags & 0x0010) {
            return false;
        }
        if (invisibleThingTypes.includes(thing.spec.type)) {
            return false;
        }
        return true;
    }
    $: things = map.objs.filter(isVisible)
</script>

{#each map.renderSectors as renderSector, i}
    <Flats {renderSector} index={i} />
    {#each renderSector.subsec.segs as seg}
        <Wall {seg} />
    {/each}
{/each}

{#each things as thing}
    {#key thing}
        <Thing {thing} />
    {/key}
{/each}
