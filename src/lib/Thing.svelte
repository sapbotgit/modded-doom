<script lang="ts">
    import { Mesh, TransformControls } from '@threlte/core';
    import { MeshStandardMaterial, PlaneGeometry, Texture, type MeshStandardMaterialParameters, type ColorRepresentation, Color } from 'three';
    import { useDoom } from './useDoom';
    import type { DoomMap, MapObject } from '../doomwad';
    import { EIGHTH_PI, HALF_PI, QUARTER_PI } from './Math';
    import Wireframe from './Debug/Wireframe.svelte';

    const { textures, game, editor } = useDoom();

    export let thing: MapObject;
    export let map: DoomMap;

    const { position: playerPosition, direction: playerDirection } = game.player;

    const { sector, spec, position, sprite, direction } = thing;
    const { light } = $sector;
    const frames = map.wad.spriteFrames(spec.sprite);

    $: ang = Math.atan2($position.y - $playerPosition.y, $position.x - $playerPosition.x)
    $: rot = (Math.floor((ang - $direction - EIGHTH_PI) / QUARTER_PI) + 16) % 8 + 1;
    $: frame = frames[$sprite.frame][rot] ?? frames[$sprite.frame][0];

    $: texture = textures.get(frame.name, 'sprite');
    $: zPos = $position.z + texture.userData.height * .5;
    $: hOffset = texture.userData.xOffset - texture.userData.width * .5;
    $: vOffset = texture.userData.yOffset - texture.userData.height;

    $: material = new MeshStandardMaterial({ alphaTest: 1 });
    $: if (texture) {
        material.map = texture;
    }
    $: if ($sprite.fullbright || textures.lightColor($light)) {
        material.color = $sprite.fullbright ? textures.lightColor(255) : textures.lightColor($light);
    }

    $: if ($editor.selected === thing) {
        material.emissive = new Color('magenta');
        material.emissiveIntensity = 0.1;
    } else {
        material.emissiveIntensity = 0;
    }

    function hit() {
        $editor.selected = thing;
    }

    function positionChanged(ev) {
        $position.x = Math.floor(ev.detail.target.worldPosition.x);
        $position.y = Math.floor(ev.detail.target.worldPosition.y);
    }
</script>

<Mesh
    interactive={$editor.active}
    on:click={hit}
    {material}
    geometry={new PlaneGeometry(texture.userData.width, texture.userData.height)}
    scale={frame.mirror ? { x: -1 } : {}}
    rotation={{ y: $playerDirection, x: HALF_PI, order:'ZXY' }}
    position={{
        x: ($position.x + hOffset),
        y: ($position.y + hOffset),
        z: Math.max(zPos, zPos + vOffset),
    }}
>
    {#if $editor.selected === thing}
        <TransformControls
            mode='translate'
            showZ={false}
            on:object-changed={positionChanged}
        />
    {/if}
    <Wireframe />
</Mesh>
