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
    import { useThrelte } from "@threlte/core";
    import { LinearToneMapping } from "three";


    const { renderer } = useThrelte();
    renderer.toneMapping = LinearToneMapping;
    renderer.toneMappingExposure = 1.9;

    export let map: MapRuntime;
    const { rev } = map;
    const { renderSectors } = useDoomMap();

    let things: MapObject[] = [];
    $: if ($rev) {
        // don't render player here (it's in Player.svelte)
        things = map.objs.filter(e => e.type !== MapObjectIndex.MT_PLAYER);
    }
    // TODO: to actually improve performance here, I think we'll have to implement some kind of PVS
    // based on the bsp tree https://cs.gmu.edu/~jchen/cs662/lecture5-2007.pdf
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

<Player /> <!-- and camera... -->

<EditorTagLink {map} />
