<script lang="ts">
    import { MeshStandardMaterial, PlaneGeometry, Color, BackSide, FrontSide } from "three";
    import type { LineDef, PlayerMapObject, Seg, SideDef, Vertex } from "../doom";
    import { Mesh } from "@threlte/core";
    import { useDoom } from "./useDoom";
    import { HALF_PI } from "../doom/Math";
    import Wireframe from "./Debug/Wireframe.svelte";

    export let seg: Seg;
    export let linedef: LineDef;
    export let sidedef: SideDef;
    export let type: 'upper' | 'lower' | 'middle' = 'middle';

    // geometry
    export let skyHack = false;
    export let visible: boolean;
    export let width: number;
    export let height: number;
    export let top: number;
    export let mid: Vertex;

    // In MAP29 in Doom2, the teleports in the blood only have right texture but seg.direction 1 so we get nothing.
    // https://doomwiki.org/wiki/MAP29:_The_Living_End_(Doom_II)#Bugs
    // There may be other places this happens but we correct it by doing a little hack
    $: textureL = linedef.left?.[type];
    $: textureR = linedef.right[type];
    $: texture = seg.direction === 1 ? ($textureL ?? $textureR) : ($textureR ?? $textureL);

    const { yOffset, xOffset } = sidedef;
    const { xOffset: animOffset, flags } = linedef;

    const { wad, settings, textures, editor, game } = useDoom();

    const extraLight = (game.player as unknown as PlayerMapObject).extraLight;
    const { light } = sidedef.sector;
    const { zFloor : zFloorL, zCeil : zCeilL } = linedef.left?.sector ?? {};
    const { zFloor : zFloorR, zCeil : zCeilR } = linedef.right.sector

    // TODO: We could actually use MeshBasic here (and in Thing and Flat) because we don't have any dynamic lighting
    // and we get a ~25% performance boost. I'd rather keep this and use the BSP to cull walls
    $: material = new MeshStandardMaterial({ color: lineStroke() });
    $: texture2 = texture && settings.useTextures ? textures.get(texture, 'wall').clone() : null;
    $: if (texture2) {
        texture2.repeat.x = width * texture2.userData.invWidth;
        texture2.repeat.y = height * texture2.userData.invHeight;
        material.map = texture2;
    }
    $: if (texture2 && (flags || $xOffset || $yOffset || ($animOffset ?? 0))) {
        // texture alignment is complex https://doomwiki.org/wiki/Texture_alignment
        // threejs uses 0,0 in bottom left but doom uses 0,0 for top left so we by default
        // "peg" the corner to the top left by offsetting by height
        let pegging = -height;
        if (flags & 0x0004) {
            // two-sided segs with a middle texture need alpha test
            if (type === 'middle') {
                material.alphaTest = 1;
            }

            if (type === 'lower' && (flags & 0x0010)) {
                // unpegged so subtract higher floor from ceiling to get real offset
                // TODO: hmmm... the blue wall with the switch at the far side of E3M6 works with Max(ceilR, ceilL)
                // but the green wall in E1M1 zigzag works better with just ceilR.
                // Now I'm not sure which is actually correct :(
                pegging -= $zCeilR - Math.max($zFloorL, $zFloorR);
                // pegging -= Math.max($zCeilR, $zCeilL) - Math.max($zFloorL, $zFloorR);
            } else if (type === 'upper' && !(flags & 0x0008)) {
                pegging = 0;
            } else if (type === 'middle' && (flags & 0x0010)) {
                pegging = 0;
            }
        } else if (flags & 0x0010) {
            // peg to floor (bottom left)
            pegging = 0;
        }
        material.map.offset.x = (($animOffset ?? 0) + $xOffset + seg.offset) * texture2.userData.invWidth;
        material.map.offset.y = (-$yOffset + pegging) * texture2.userData.invHeight;
    }
    $: if ($light !== undefined) {
        material.color = textures.lightColor($light + $extraLight);
    }

    $: if ($editor.selected === linedef) {
        material.emissive = new Color('magenta');
        material.emissiveIntensity = 0.1;
    } else {
        material.emissiveIntensity = 0;
    }

    $: if (skyHack) {
        material.colorWrite = false;
        material.depthWrite = true;
    }

    function lineStroke() {
        return !linedef.left ? wad.palettes[0][176] :
            (linedef.left.sector.zFloor !== linedef.right.sector.zFloor) ? wad.palettes[0][64] :
            (linedef.left.sector.zCeil !== linedef.right.sector.zCeil) ?  wad.palettes[0][231] :
            wad.palettes[0][96];
    }

    function hit() {
        $editor.selected = linedef;
    }
</script>

<Mesh
    visible={visible}
    interactive={$editor.active}
    on:click={hit}
    renderOrder={skyHack ? 0 : 1}
    position={{ x: mid.x, y: mid.y, z: top - height * .5 }}
    rotation={{ z: seg.angle, x: HALF_PI, order:'ZXY' }}
    geometry={new PlaneGeometry(width, height)}
    material={material}
>
    <Wireframe />
</Mesh>
