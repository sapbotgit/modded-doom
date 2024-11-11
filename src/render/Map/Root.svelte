<script lang="ts">
    import { MapObject, type MapRuntime, type Sprite } from "../../doom";
    import { useAppContext, useDoomMap } from "../DoomContext";
    import BlockMap from "../Debug/BlockMap.svelte";
    import Stats from "../Debug/Stats.svelte";
    import EditorTagLink from "../Editor/EditorTagLink.svelte";
    import Player from "./Player.svelte";
    import SkyBox from "./SkyBox.svelte";
    import Sector from "./Sector.svelte";
    import { interactivity } from "@threlte/extras";
    import ShotTrace from "./ShotTrace.svelte";
    import { onDestroy } from "svelte";

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

    // This is a hack to re-enable the $sprite readable for R1.
    const updateSprite = (mo: MapObject, sprite: Sprite) => mo.sprite.set(sprite);
    map.events.on('mobj-updated-sprite', updateSprite);
    onDestroy(() => map.events.off('mobj-updated-sprite', updateSprite));

    // Another similar hack
    $: map.synchronizeSpecials('r1');
    onDestroy(() => map.synchronizeSpecials());

    // TODO: to actually improve performance here, I think we'll have to implement some kind of PVS
    // based on the bsp tree https://cs.gmu.edu/~jchen/cs662/lecture5-2007.pdf
</script>

<Stats />

<SkyBox />

<BlockMap {map} />

{#each renderSectors as renderSector}
    <Sector {renderSector} />
{/each}

{#each tracers as trace (trace.id)}
    <ShotTrace {trace} />
{/each}

<Player /> <!-- and camera... -->

<EditorTagLink {map} />
