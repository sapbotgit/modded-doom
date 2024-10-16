<script lang="ts" context="module">
    let mapName: string;
    let wallCache = new Map<string, number>();
</script>
<script lang="ts">
    import { PlaneGeometry } from "three";
    import { HALF_PI, type LineDef, type Vertex } from "../../doom";
    import { useDoom } from "../DoomContext";
    import type { GeometryBuilder } from "./MapGeometry.svelte";
    import { getContext, onDestroy } from "svelte";

    export let linedef: LineDef;
    export let useLeft = false;
    export let type: 'upper' | 'lower' | 'middle' = 'middle';

    // geometry
    export let skyHack = false;
    export let angle: number;
    export let width: number;
    export let height: number;
    export let top: number;
    export let mid: Vertex;
    export let doubleSidedMiddle = false;

    const sidedef = useLeft ? linedef.left : linedef.right;
    // In MAP29 in Doom2, the teleports in the blood only have right texture but seg.direction 1 so we get nothing.
    // https://doomwiki.org/wiki/MAP29:_The_Living_End_(Doom_II)#Bugs
    // There may be other places this happens but we correct it by doing a little hack
    // Actually gzdoom has lots of little corrections https://github.com/ZDoom/gzdoom/blob/master/wadsrc/static/zscript/level_compatibility.zs
    $: textureL = linedef.left?.[type];
    $: textureR = linedef.right[type];
    $: texture = useLeft ? ($textureL ?? $textureR) : ($textureR ?? $textureL);

    const { yOffset, xOffset } = sidedef;
    const { xOffset: animOffset, flags } = linedef;

    const { wad } = useDoom();

    const { zFloor : zFloorL } = linedef.left?.sector ?? {};
    const { zFloor : zFloorR, zCeil : zCeilR, skyHeight } = linedef.right.sector

    // texture alignment is complex https://doomwiki.org/wiki/Texture_alignment
    $: if (texture && doubleSidedMiddle) {
        const pic = wad.wallTextureData(texture);
        // double sided linedefs (generally for semi-transparent textures like gates/fences) do not repeat vertically
        height = Math.min(height, pic.height);
        if (linedef.flags & 0x0010) {
            // see cages in plutonia MAP24
            top = Math.max(zFloorL.val, zFloorR.val) + height;
        }
    }
    function pegging(linedef: LineDef) {
        let offset = 0;
        if (linedef.left) {
            if (type === 'lower' && (flags & 0x0010)) {
                // unpegged so subtract higher floor from ceiling to get real offset
                // NOTE: we use skyheight (if available) instead of zCeil because of the blue wall switch in E3M6.
                offset = (skyHeight ?? $zCeilR) - Math.max($zFloorL, $zFloorR);
            } else if (type === 'upper' && !(flags & 0x0008)) {
                offset = -height;
            } else if (type === 'middle') {
                offset = -height;
            }
        } else if (linedef.flags & 0x0010) {
            // peg to floor (bottom left)
            offset = -height;
        }
        return offset;
    }

    let lastLeft = useLeft;
    const mapGeo = getContext<GeometryBuilder>('doom-map-geo');
    const geo = new PlaneGeometry(width, height);
    geo.userData['sky'] = skyHack;
    // this cache is a total hack to allow us to add geometry to the map but not really remove it
    const key = [type, linedef.num, angle, useLeft, skyHack].join(':');
    const wallGeo = wallCache.get(key) ?? mapGeo.addWallFragment(geo, sidedef.sector.num);
    wallCache.set(key, wallGeo);
    geo.rotateX(HALF_PI);
    geo.rotateZ(angle + (useLeft ? Math.PI : 0));
    geo.translate(mid.x, mid.y, top - height * .5);

    $: mapGeo.changeWallHeight(wallGeo, top, height);
    $: mapGeo.applyWallTexture(wallGeo, texture, width, height,
        $xOffset + ($animOffset ?? 0),
        $yOffset + pegging(linedef));
    $: if (lastLeft !== useLeft) {
        mapGeo.flipZ(wallGeo);
    }

    // make wall invisible
    onDestroy(() => {
        mapGeo.changeWallHeight(wallGeo, 0, 0);
    })
</script>