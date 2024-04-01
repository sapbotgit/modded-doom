<script lang="ts">
    import type { MapRuntime, SideDef } from "../../doom";
    import { useDoom } from "../DoomContext";
    import SectorEditor from "./SectorEditor.svelte";
    import TextureChooser from "./TextureChooser.svelte";

    export let sidedef: SideDef;
    export let map: MapRuntime;

    const { wad } = useDoom();
    let { xOffset, yOffset, upper, middle, lower } = sidedef;
</script>

<div class="bg-base-100 rounded-box p-2">
    <label class="label">
        <span class="label-text">Texture x-offset {$xOffset}</span>
        <input class="range" type="range" min="-256" max="256" bind:value={$xOffset} />
    </label>
    <label class="label">
        <span class="label-text">Texture y-offset {$yOffset}</span>
        <input class="range" type="range" min="-256" max="256" bind:value={$yOffset} />
    </label>
    <TextureChooser {wad} label="Upper" type="wall" bind:value={$upper} on:change={() => map.initializeTextureAnimation(upper, 'wall')} />
    <TextureChooser {wad} label="Middle" type="wall" bind:value={$middle} on:change={() => map.initializeTextureAnimation(middle, 'wall')} />
    <TextureChooser {wad} label="Lower" type="wall" bind:value={$lower} on:change={() => map.initializeTextureAnimation(lower, 'wall')} />

    <div class="bg-base-300 rounded-box p-2 mt-4 flex flex-col gap-2">
        <SectorEditor {map} sector={sidedef.sector} />
    </div>
</div>
