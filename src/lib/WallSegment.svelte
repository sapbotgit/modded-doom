<script lang="ts">
    import { MeshStandardMaterial, PlaneGeometry } from "three";
    import type { LineDef, SideDef, Vertex } from "../doomwad";
    import { Mesh } from "@threlte/core";
    import { useDoom } from "./useDoom";

    export let linedef: LineDef;
    export let sidedef: SideDef;
    export let useLeft = false;
    export let type: 'upper' | 'lower' | 'middle' = 'middle';

    $: texture = sidedef[type];
    const { xOffset } = linedef;

    // geometry
    export let width: number;
    export let height: number;
    export let top: number;
    export let mid: Vertex;
    export let angle: number;

    const { wad, settings, textures } = useDoom();

    $: offset = useLeft ? Math.PI : 0;
    const { light } = sidedef.sector;
    const { zFloor : zFloorL, zCeil : zCeilL } = linedef.left?.sector ?? {};
    const { zFloor : zFloorR, zCeil : zCeilR } = linedef.right.sector

    function material(name: string, xOffset: number, light: number) {
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
                // TODO: hmmm... the blue wall with the switch at the far side of E3M6 works with Max(ceilR, ceilL)
                // but the green wall in E1M1 zigzag works better with just ceilR.
                // Now I'm not sure which is actually correct :(
                pegging -= $zCeilR - Math.max($zFloorL, $zFloorR);
                // pegging -= Math.max($zCeilR, $zCeilL) - Math.max($zFloorL, $zFloorR);
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
        texture2.offset.set((xOffset + sidedef.xOffset) * invTextureWidth, yOffset * invTextureHeight);
        let color = light | light << 8 | light << 16;
        // TODO: We could actually use MeshBasic here (and in Thing and Flat) because we don't have any dynamic lighting
        // and we get a ~25% performance boost. I'd rather keep this and figure out a way to cull
        return new MeshStandardMaterial({ map: texture2, alphaTest: 1, color });
    }

    function lineStroke() {
        return !linedef.left ? wad.palettes[0][176] :
            (linedef.left.sector.zFloor !== linedef.right.sector.zFloor) ? wad.palettes[0][64] :
            (linedef.left.sector.zCeil !== linedef.right.sector.zCeil) ?  wad.palettes[0][231] :
            wad.palettes[0][96];
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
    material={material($texture, $xOffset ?? 0, $light)}
/>
