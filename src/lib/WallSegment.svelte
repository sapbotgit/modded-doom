<script lang="ts">
    import { MeshStandardMaterial, PlaneGeometry } from "three";
    import type { LineDef, SideDef, Vertex } from "../doomwad";
    import { Mesh } from "@threlte/core";
    import { useDoom } from "./useDoom";
    import { onDestroy } from "svelte";

    export let linedef: LineDef;
    export let useLeft: boolean = false;
    export let textureName: string;
    export let sidedef: SideDef;
    export let scrollOffsetX: number;
    export let type: 'upper' | 'lower' | 'middle' = 'middle';

    // geometry
    export let mid: Vertex;
    export let height: number;
    export let top: number;
    export let width: number;
    export let angle: number;

    const { wad, settings, textures, game } = useDoom();

    $: texName = textureName;
    $: offset = useLeft ? Math.PI : 0;

    function material(name: string, xOffset: number) {
        if (!name || !settings.useTextures) {
            return new MeshStandardMaterial({ color: lineStroke() });
        }

        const texture2 = textures.get(name, 'wall').clone();

        const invTextureWidth = texture2.userData.invWidth;
        const invTextureHeight = texture2.userData.invHeight;
        texture2.repeat.set(width * invTextureWidth, height * invTextureHeight);

        // texture alignment is complex https://doomwiki.org/wiki/Texture_alignment
        // threejs uses 0,0 in bottom left but doom uses 0,0 for top left so we by default
        // "peg" the corner to the top left by offsetting by height
        let pegging = -height;
        if (linedef.flags & 0x0004) {
            // two-sided
            if (type === 'lower' && (linedef.flags & 0x0010)) {
                // unpegged so subtract higher floor from ceiling to get real offset
                pegging -= sidedef.sector.zCeil - Math.max(linedef.left.sector.zFloor, linedef.right.sector.zFloor);
            } else if (type === 'upper' && !(linedef.flags & 0x0008)) {
                pegging = 0;
            } else if (type === 'middle' && (linedef.flags & 0x0010)) {
                pegging = 0;
            }
        } else if (linedef.flags & 0x0010) {
            // peg to floor (bottom left)
            pegging = 0;
        }
        const yOffset = -sidedef.yOffset + pegging;
        texture2.offset.set((xOffset + sidedef.xOffset) * invTextureWidth, yOffset * invTextureHeight)
        return new MeshStandardMaterial({ map: texture2, transparent: true });
    }

    function lineStroke() {
        return !linedef.left ? wad.palettes[0][176] :
            (linedef.left.sector.zFloor !== linedef.right.sector.zFloor) ? wad.palettes[0][64] :
            (linedef.left.sector.zCeil !== linedef.right.sector.zCeil) ?  wad.palettes[0][231] :
            wad.palettes[0][96];
    }

    let textureChange: () => void = null;
    function stopFrameAnimation() {
        game.removeEventListener('textureAnimationTick', textureChange);
        texName = textureName;
    }
    onDestroy(stopFrameAnimation);

    $: animationInfo = wad.animatedWallInfo(textureName);
    $: if (animationInfo) {
        stopFrameAnimation();
        let [index, frames] = animationInfo;
        textureChange = () => {
            index = (index + 1) % frames.length;
            texName = frames[index];
        };
        game.addEventListener('textureAnimationTick', textureChange);
    } else {
        stopFrameAnimation();
    }

    function hit() {
        console.log(linedef)
    }
</script>

<Mesh
    interactive
    on:click={hit}
    position={{ x: mid.x, y: top - height * .5, z: -mid.y }}
    rotation={{ y: angle + offset }}
    geometry={new PlaneGeometry(width, height)}
    material={material(texName, scrollOffsetX)}
/>
