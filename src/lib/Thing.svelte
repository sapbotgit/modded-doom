<script lang="ts">
    import { Mesh } from '@threlte/core';
    import { MeshStandardMaterial, PlaneGeometry } from 'three';
    import { useDoom } from './useDoom';
    import type { DoomMap, DoomWad, RenderThing } from '../doomwad';
    import { EIGHTH_PI, HALF_PI, QUARTER_PI } from './Math';

    const { textures, game } = useDoom();

    export let thing: RenderThing;
    export let map: DoomMap;
    export let wad: DoomWad;
    const { playerPosition, playerDirection } = game;
    const frames = wad.spriteFrames(thing.spec.sprite);

    $: pos = thing.position;
    $: sector = map.findSector($pos.x, $pos.y);
    $: zFloor = sector.zFloor;
    $: zCeil = sector.zCeil;
    $: light = sector.light;

    $: sprite = thing.sprite;
    $: direction = thing.direction;
    $: ang = Math.atan2($pos.y + $playerPosition.z, $pos.x - $playerPosition.x)
    $: rot = (Math.floor((ang - $direction - EIGHTH_PI) / QUARTER_PI) + 16) % 8 + 1;
    $: frame = frames[$sprite.frame][rot] ?? frames[$sprite.frame][0];
    $: texture = textures.get(frame.name, 'sprite');

    $: scale = (texture && frame.mirror) ? { x: -1 } : {}
    $: height = texture.userData.height * .5;
    $: yPos = thing.fromFloor ? $zFloor + height : $zCeil - height;

    $: color = $sprite.fullbright ? 'white' : $light | $light << 8 | $light << 16;
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
    {scale}
    rotation={{ y: $playerDirection - HALF_PI }}
    position={{ x: $pos.x, z: -$pos.y, y: yPos }}
/>
