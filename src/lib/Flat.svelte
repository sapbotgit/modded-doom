<script lang="ts">
    import { Mesh } from "@threlte/core";
    import type { RenderSector, Sector } from "../doomwad";
    import { BackSide, BufferGeometry, FrontSide, MeshStandardMaterial, MultiplyBlending, type MeshStandardMaterialParameters, AdditiveBlending, NormalBlending, NoBlending } from "three";
    import { useDoom } from "./useDoom";
    import Wireframe from "./Debug/Wireframe.svelte";

    export let renderSector: RenderSector;
    export let geometry: BufferGeometry;
    export let textureName: string;
    export let vertical: number;
    export let color: number;
    export let ceiling = false;

    const { game } = useDoom();
    const { playerPosition } = game;

    const { textures, settings, editor } = useDoom();
    const { light } = renderSector.sector;
    $: visible = (ceiling && $playerPosition.z <= vertical)
            || (!ceiling && $playerPosition.z >= vertical);

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

<!--
    TODO: for a level editor, it would actually be useful to still draw this so
    we can click on it and edit. Something to think about (same for Wall.svelte)
-->
{#if textureName !== 'F_SKY1'}
    <Mesh
        {visible}
        interactive={$editor.active}
        {geometry}
        material={material(textureName, $light, $editor.selected)}
        position={{ z: vertical }}
        on:click={hit}
    >
        <Wireframe />
    </Mesh>
{/if}
