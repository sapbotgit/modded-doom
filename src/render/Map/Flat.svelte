<script lang="ts">
    import { Mesh } from "@threlte/core";
    import { BackSide, Color, FrontSide, MeshStandardMaterial } from "three";
    import { useAppContext, useDoom, useDoomMap } from "../DoomContext";
    import Wireframe from "../Debug/Wireframe.svelte";
    import { namedColor, type RenderSector } from "../RenderData";

    export let renderSector: RenderSector;
    export let textureName: string;
    export let vertical: number;
    export let ceiling = false;

    const { map } = useDoomMap();
    const { settings, editor } = useAppContext();
    const { useTextures, cameraMode } = settings;
    const { textures } = useDoom();
    const { position: cameraPosition } = map.camera;
    const extraLight = map.player.extraLight;
    const geometry = renderSector.geometry;
    const vis = renderSector.visible;

    $: visible = $vis && ((ceiling && $cameraPosition.z <= vertical)
            || (!ceiling && $cameraPosition.z >= vertical));
    const light = renderSector.flatLighting;

    $: material = new MeshStandardMaterial({ emissive: 'magenta', side: ceiling ? BackSide : FrontSide });
    $: material.emissiveIntensity = ($editor.selected === renderSector.sector) ? 0.1 : 0;
    $: if (textureName) {
        material.map = $useTextures ? textures.get(textureName, 'flat') : null;
        material.transparent = ($cameraMode === 'ortho');
        material.needsUpdate = true;
    }
    $: if ($light !== undefined) {
        const col = textures.lightColor($light + $extraLight);
        material.color = $useTextures ? col : new Color(namedColor(renderSector.sector.num)).lerp(col, .5);
    }

    $: isSky = textureName === 'F_SKY1';
    $: if (isSky) {
        material.colorWrite = false;
        material.depthWrite = true;
    }

    function hit() {
        $editor.selected = renderSector.sector;
    }
</script>

<Mesh
    userData={{ type: 'flat' }}
    interactive={$editor.active}
    {visible}
    {geometry}
    {material}
    renderOrder={isSky ? 0 : 1}
    position={{ z: vertical }}
    on:click={hit}
>
    <Wireframe />
</Mesh>
