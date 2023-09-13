<script lang="ts">
    import type { MapObject, MapRuntime } from "../../doom";
    import { useDoomMap } from "../DoomContext";
    import BlockMap from "../Debug/BlockMap.svelte";
    import Stats from "../Debug/Stats.svelte";
    import EditorTagLink from "../Editor/EditorTagLink.svelte";
    import Flats from "./Flats.svelte";
    import Player from "./Player.svelte";
    import SkyBox from "./SkyBox.svelte";
    import Thing from "./Thing.svelte";
    import Wall from "./Wall.svelte";

    export let map: MapRuntime;
    const { rev } = map;
    const { renderSectors } = useDoomMap();

    let things: MapObject[] = [];
    $: if ($rev) {
        // don't render player here (it's in Player.svelte)
        things = map.objs.filter(e => e.source.type !== 1);
    }
</script>

<Stats />

<SkyBox />

<BlockMap {map} />

{#each renderSectors as renderSector, i}
    <Flats {renderSector} index={i} />
    {#each renderSector.segs as seg}
        <Wall {seg} />
    {/each}
{/each}

{#each things as thing (thing.id)}
    <Thing {thing} />
{/each}

<Player />

<EditorTagLink {map} />
