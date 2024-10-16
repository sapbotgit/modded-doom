<script lang="ts">
    import { MapObjectIndex, type MapRuntime } from "../../doom";
    import { useAppContext, useDoomMap } from "../DoomContext";
    import Stats from "../Debug/Stats.svelte";
    import SkyBox from "../Map/SkyBox.svelte";
    import Player from "../Map/Player.svelte";
    import MapGeometry from "./MapGeometry.svelte";
    import { interactivity } from "@threlte/extras";

    export let map: MapRuntime;
    const { renderSectors } = useDoomMap();
    const trev = map.trev;
    let tracers: typeof map.tracers;
    $: if ($trev) {
        tracers = map.tracers;
    }

    const { editor } = useAppContext();
    const interact = interactivity({ enabled: $editor.active });
    $: interact.enabled.set($editor.active);

    // TODO: to actually improve performance here, I think we'll have to implement some kind of PVS
    // based on the bsp tree https://cs.gmu.edu/~jchen/cs662/lecture5-2007.pdf
</script>

<Stats />

<SkyBox />

<MapGeometry />

<!-- {#each renderSectors as renderSector}
    {@const mo = [...renderSector.mobjs.val].sort((a, b) => a.id - b.id)}
    {#each mo as thing (thing.id)}
        {#if thing.type !== MapObjectIndex.MT_PLAYER}
            <Thing {renderSector} {thing} />
        {/if}
    {/each}
{/each} -->

<Player />