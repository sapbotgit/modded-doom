<script lang="ts">
    import { type MapRuntime } from "../../doom";
    import { useDoomMap } from "../DoomContext";
    import BlockMap from "../Debug/BlockMap.svelte";
    import Stats from "../Debug/Stats.svelte";
    import EditorTagLink from "../Editor/EditorTagLink.svelte";
    import Player from "./Player.svelte";
    import SkyBox from "./SkyBox.svelte";
    import Sector from "./Sector.svelte";

    export let map: MapRuntime;
    const { renderSectors } = useDoomMap();

    // TODO: to actually improve performance here, I think we'll have to implement some kind of PVS
    // based on the bsp tree https://cs.gmu.edu/~jchen/cs662/lecture5-2007.pdf
</script>

<Stats />

<SkyBox />

<BlockMap {map} />

{#each renderSectors as renderSector}
    <Sector {renderSector} />
{/each}

<Player /> <!-- and camera... -->

<EditorTagLink {map} />
