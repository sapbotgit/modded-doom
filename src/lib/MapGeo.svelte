<script lang="ts">
    import type { MapRuntime, MapObject } from "../doom";
    import Flats from "./Flats.svelte";
    import Wall from "./Wall.svelte";
    import Thing from "./Thing.svelte";
    import BlockMap from "./Debug/BlockMap.svelte";
    import { Canvas, type ThrelteContext } from "@threlte/core";
    import EditorTagLink from "./Editor/EditorTagLink.svelte";
    import Player from "./Player.svelte";
    import SkyBox from "./SkyBox.svelte";
    import HUD from "./HUD/HUD.svelte";
    import Stats from "./Debug/Stats.svelte";
    import { Clock } from "three";
    import { onMount, setContext } from "svelte";
    import { useDoom } from "./DoomContext";
    import { buildRenderSectors } from "./RenderData";

    export let map: MapRuntime;
    const { rev } = map;
    const { settings } = useDoom();

    const renderSectors = buildRenderSectors(map.data.nodes);
    setContext('doom-map', { map, renderSectors });

    let things: MapObject[] = [];
    $: if ($rev) {
        // don't render player here (it's in Player.svelte)
        things = map.objs.filter(e => e.source.type !== 1);
    }

    let clock = new Clock();
    let threlteCtx: ThrelteContext;
    onMount(() => {
        const interval = 1 / settings.targetFPS;
        let delta = 0;
        let frameDelta = 0;
        let frameReq: number;
        function update() {
            frameReq = requestAnimationFrame(update);
            const d = clock.getDelta();
            delta += d;
            frameDelta += d;
            if (frameDelta > interval) {
                threlteCtx.advance();
                map.game.tick(delta);
                delta = 0;
                frameDelta = frameDelta % interval;
            }
        }
        update();
        return () => cancelAnimationFrame(frameReq);
    });
</script>

<Canvas size={{ width: 800, height: 600 }} frameloop='never' bind:ctx={threlteCtx}>
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
</Canvas>
<HUD player={map.player} />
