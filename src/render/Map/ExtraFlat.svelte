<script lang="ts">
    import type { ExtraFlat, RenderSector } from "../RenderData";
    import Flat from "./Flat.svelte";

    export let renderSector: RenderSector;
    export let flat: ExtraFlat;

    const { z, lightSector, flat: texture, ceil } = flat;
    const zOffset = ceil ? 0.01 : -0.01;
    const light = lightSector.light;
</script>

<Flat
    ceiling={flat.ceil}
    {renderSector}
    light={$light}
    vertical={$z + zOffset}
    textureName={$texture}
/>