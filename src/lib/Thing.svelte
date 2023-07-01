<script lang="ts">
    import { Mesh, TransformControls } from '@threlte/core';
    import { MeshStandardMaterial, PlaneGeometry, Texture, type MeshStandardMaterialParameters, type ColorRepresentation, Vector3 } from 'three';
    import { useDoom } from './useDoom';
    import type { DoomMap, RenderThing } from '../doomwad';
    import { EIGHTH_PI, HALF_PI, QUARTER_PI } from './Math';
    import Wireframe from './Debug/Wireframe.svelte';

    const { textures, game, editor } = useDoom();

    export let thing: RenderThing;
    export let map: DoomMap;

    const { playerPosition, playerDirection } = game;

    const { spec, position, sprite, direction } = thing;
    const frames = map.wad.spriteFrames(spec.sprite);

    $: ang = Math.atan2($position.y - $playerPosition.y, $position.x - $playerPosition.x)
    $: rot = (Math.floor((ang - $direction - EIGHTH_PI) / QUARTER_PI) + 16) % 8 + 1;
    $: frame = frames[$sprite.frame][rot] ?? frames[$sprite.frame][0];

    $: texture = textures.get(frame.name, 'sprite');
    $: sector = map.findSector($position.x, $position.y);
    $: zFloor = sector.zFloor;
    $: zCeil = sector.zCeil;
    $: light = sector.light;
    $: halfHeight = texture.userData.height * .5;
    $: zPos = thing.fromFloor ? $zFloor + halfHeight : $zCeil - halfHeight;
    $: hOffset = texture.userData.xOffset - texture.userData.width * .5;
    $: vOffset = texture.userData.yOffset - texture.userData.height;

    $: color = $sprite.fullbright ? 'white' : textures.lightColor($light);

    function material(map: Texture, color: ColorRepresentation, selected: RenderThing) {
        const params: MeshStandardMaterialParameters = { map, color, alphaTest: 1 };
        if (selected === thing) {
            params.emissive = 'magenta';
            params.emissiveIntensity = 0.1;
        }
        return new MeshStandardMaterial(params);
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
    material={material(texture, color, $editor.selected)}
    geometry={new PlaneGeometry(texture.userData.width, texture.userData.height)}
    scale={frame.mirror ? { x: -1 } : {}}
    rotation={{ y: $playerDirection - HALF_PI, x: HALF_PI, order:'ZXY' }}
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
            on:dragging-changed={drag}
            on:object-changed={positionChanged}
        />
    {/if}
    <Wireframe />
</Mesh>
