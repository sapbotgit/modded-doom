<script lang="ts">
    import { Mesh } from '@threlte/core';
    import { MeshStandardMaterial, PlaneGeometry } from 'three';
    import { useDoom } from './useDoom';
    import type { DoomMap, DoomWad, RenderThing } from '../doomwad';
    import { HALF_PI } from './Math';

    const { textures, game } = useDoom();

    export let thing: RenderThing;
    export let map: DoomMap;
    export let wad: DoomWad;
    const { playerDirection } = game;

    $: yRot = Math.atan2(-$playerDirection.z, $playerDirection.x)
    $: pos = thing.position;
    $: sector = map.findSector($pos.x, $pos.y);
    $: zFloor = sector.zFloor;
    $: zCeil = sector.zCeil;
    $: light = sector.light;

    $: sprite = thing.sprite;
    $: texture = textures.get($sprite.name, 'sprite');
    $: height = texture.userData.height * .5;
    $: yPos = thing.fromFloor ? $zFloor + height : $zCeil - height;

    $: color = $light | $light << 8 | $light << 16;
    $: material = new MeshStandardMaterial({ map: texture, color, alphaTest: 1 });
    $: geometry = new PlaneGeometry(texture.userData.width, texture.userData.height);

    function hit() {
        console.log(thing)
    }
</script>

<Mesh
    interactive
    on:click={hit}
    {material}
    {geometry}
    scale={{ x:  -1}}
    rotation={{ y: yRot - HALF_PI }}
    position={{ x: $pos.x, z: -$pos.y, y: yPos }}
/>
