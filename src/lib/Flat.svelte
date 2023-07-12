<script lang="ts">
    import { Mesh } from "@threlte/core";
    import type { RenderSector } from "../doomwad";
    import { BackSide, BufferGeometry, FrontSide, MeshStandardMaterial, Color } from "three";
    import { useDoom } from "./useDoom";
    import Wireframe from "./Debug/Wireframe.svelte";

    export let renderSector: RenderSector;
    export let geometry: BufferGeometry;
    export let textureName: string;
    export let vertical: number;
    export let color: number;
    export let ceiling = false;

    const { game, textures, settings, editor } = useDoom();
    const { position: playerPosition } = game.player;

    $: visible = (ceiling && $playerPosition.z <= vertical)
            || (!ceiling && $playerPosition.z >= vertical);
    const { light } = renderSector.sector;

    $: material = new MeshStandardMaterial({ color, side: ceiling ? BackSide : FrontSide });
    $: if (textureName && settings.useTextures) {
        material.map = textures.get(textureName, 'flat');
    }
    $: if ($light) {
        material.color = textures.lightColor($light);
    }
    $: if ($editor.selected === renderSector.sector) {
        material.emissive = new Color('magenta');
        material.emissiveIntensity = 0.1;
    } else {
        material.emissiveIntensity = 0;
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
        {material}
        position={{ z: vertical }}
        on:click={hit}
    >
        <Wireframe />
    </Mesh>
{/if}
