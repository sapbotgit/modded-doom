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

<div>
    <label>
        <input type="range" min="-256" max="256" bind:value={$xOffset} />
        Texture x-offset {$xOffset}
    </label>
    <label>
        <input type="range" min="-256" max="256" bind:value={$yOffset} />
        Texture y-offset {$yOffset}
    </label>
    <div>
        <div>Upper</div>
        <TextureChooser {wad} type="wall" bind:value={$upper} on:change={() => map.initializeTextureAnimation(upper, 'wall')} />
    </div>
    <div>
        <div>Middle</div>
        <TextureChooser {wad} type="wall" bind:value={$middle} on:change={() => map.initializeTextureAnimation(middle, 'wall')} />
    </div>
    <div>
        <div>Lower</div>
        <TextureChooser {wad} type="wall" bind:value={$lower} on:change={() => map.initializeTextureAnimation(lower, 'wall')} />
    </div>

    <SectorEditor {map} sector={sidedef.sector} />
</div>
