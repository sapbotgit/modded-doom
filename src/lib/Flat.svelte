<script lang="ts">
    import { Mesh } from "@threlte/core";
    import type { RenderSector, Sector } from "../doomwad";
    import { BackSide, BufferGeometry, FrontSide, MeshStandardMaterial, MultiplyBlending, type MeshStandardMaterialParameters, AdditiveBlending, NormalBlending, NoBlending } from "three";
    import { useDoom } from "./useDoom";

    export let renderSector: RenderSector;
    export let geometry: BufferGeometry;
    export let textureName: string;
    export let vertical: number;
    export let color: number;
    export let ceiling = false;

    const { textures, settings, editor } = useDoom();
    const { light } = renderSector.sector;

    function material(name: string, light: number, selected: Sector) {
        const params: MeshStandardMaterialParameters = { side: ceiling ? BackSide : FrontSide };
        if (settings.useTextures && name) {
            params.map = textures.get(name, 'flat');
            params.color = textures.lightColor(light);
        } else {
            params.color = color;
        }
        if (selected === renderSector.sector) {
            params.emissive = 'magenta';
            params.emissiveIntensity = 0.1;
        }
        // TODO: use MeshBasic here (and WallSegment and Thing) because we only have one ambient light
        return new MeshStandardMaterial(params);
    }

    function hit() {
        $editor.selected = renderSector.sector;
    }
</script>

<Mesh
    interactive={$editor.active}
    {geometry}
    material={material(textureName, $light, $editor.selected)}
    position={{ x: 0, y: vertical, z: 0 }}
    on:click={hit}
/>
