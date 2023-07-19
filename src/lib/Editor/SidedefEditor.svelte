<script lang="ts">
    import type { DoomMap, SideDef } from "../../doom";
    import SectorEditor from "./SectorEditor.svelte";
    import TextureChooser from "./TextureChooser.svelte";

    export let sidedef: SideDef;
    export let map: DoomMap;

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
        <span>Upper</span>
        <TextureChooser wad={map.wad} type="wall" bind:value={$upper} />
    </div>
    <div>
        <span>Middle</span>
        <TextureChooser wad={map.wad} type="wall" bind:value={$middle} />
    </div>
    <div>
        <span>Lower</span>
        <TextureChooser wad={map.wad} type="wall" bind:value={$lower} />
    </div>

    <SectorEditor {map} sector={sidedef.sector} />
</div>
