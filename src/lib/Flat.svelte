<script lang="ts">
    import { Mesh } from "@threlte/core";
    import type { RenderSector } from "../doomwad";
    import { BackSide, BufferGeometry, FrontSide, MeshStandardMaterial, type MeshStandardMaterialParameters } from "three";
    import { onDestroy } from "svelte";
    import { useDoom } from "./useDoom";

    export let renderSector: RenderSector;
    export let geometry: BufferGeometry;
    export let textureName: string;
    export let vertical: number;
    export let color: number;
    export let ceiling = false;

    const { game, textures, settings, wad } = useDoom();
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

    // This is a lot of boiler plate for animation. Basically the same code exists in
    // WallSegment too but I'm not sure how to better express this right now. We need
    // some kind of ticker which means a callback on tick and the callback updates state
    // and mess follows. Hmmm
    let textureChange: () => void = null;
    function stopAnimation() {
        game.removeEventListener('textureAnimationTick', textureChange);
        texName = textureName;
    }
    onDestroy(stopAnimation);

    $: texName = textureName;
    $: animationInfo = wad.animatedFlatInfo(textureName);
    $: if (animationInfo) {
        stopAnimation();
        let [index, frames] = animationInfo;
        textureChange = () => {
            index = (index + 1) % frames.length;
            texName = frames[index];
        };
        game.addEventListener('textureAnimationTick', textureChange);
    } else {
        stopAnimation();
    }

    function hit() {
        console.log(renderSector);
    }
</script>

<Mesh
    interactive
    {geometry}
    material={material(texName, $light)}
    position={{ x: 0, y: vertical, z: 0 }}
    on:click={hit}
/>
