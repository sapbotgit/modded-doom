<script lang="ts">
    import { Mesh } from '@threlte/core';
    import { MeshStandardMaterial, PlaneGeometry } from 'three';
    import { useDoom } from './useDoom';
    import type { DoomMap, DoomWad, RenderThing } from '../doomwad';
    import { EIGHTH_PI, QUARTER_PI } from './Math';

    const { textures, game } = useDoom();

    export let thing: RenderThing;
    export let map: DoomMap;
    export let wad: DoomWad;
    const { playerPosition, playerDirection } = game;
    const frames = wad.spriteFrames(thing.spec.sprite);

    const { position, sprite, direction } = thing;

    $: ang = Math.atan2($position.y + $playerPosition.z, $position.x - $playerPosition.x)
    $: rot = (Math.floor((ang - $direction - EIGHTH_PI) / QUARTER_PI) + 16) % 8 + 1;
    $: frame = frames[$sprite.frame][rot] ?? frames[$sprite.frame][0];

    const { zFloor, zCeil, light } = map.findSector($position.x, $position.y);
    $: texture = textures.get(frame.name, 'sprite');
    $: height = texture.userData.height * .5;
    $: yPos = thing.fromFloor ? $zFloor + height : $zCeil - height;

    $: color = $sprite.fullbright ? 'white' : $light | $light << 8 | $light << 16;

    function hit() {
        console.log(thing)
    }
</script>

<Mesh
    interactive
    on:click={hit}
    material={new MeshStandardMaterial({ map: texture, color, alphaTest: 1 })}
    geometry={new PlaneGeometry(texture.userData.width, texture.userData.height)}
    scale={frame.mirror ? { x: -1 } : {}}
    rotation={{ y: $playerDirection }}
    position={{ x: $position.x, z: -$position.y, y: yPos }}
/>
