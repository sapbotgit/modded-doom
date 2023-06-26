<script lang="ts">
    import { Mesh } from "@threlte/core";
    import type { RenderSector } from "../doomwad";
    import { BackSide, BufferGeometry, FrontSide, MeshStandardMaterial, type MeshStandardMaterialParameters } from "three";
    import { useDoom } from "./useDoom";

    export let renderSector: RenderSector;
    export let geometry: BufferGeometry;
    export let textureName: string;
    export let vertical: number;
    export let color: number;
    export let ceiling = false;

    const { textures, settings } = useDoom();
    const { light } = renderSector.sector;

    function material(name: string, light: number) {
        const params: MeshStandardMaterialParameters = { side: ceiling ? BackSide : FrontSide};
        if (settings.useTextures && name) {
            params.map = textures.get(name, 'flat');
            params.color = light | light << 8 | light << 16;
        } else {
            params.color = color;
        }
        return new MeshStandardMaterial(params);
    }

    function hit() {
        console.log(renderSector);
    }
</script>

<Mesh
    interactive
    {geometry}
    material={material(textureName, $light)}
    position={{ x: 0, y: vertical, z: 0 }}
    on:click={hit}
/>
