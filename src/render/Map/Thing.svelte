<script lang="ts" context="module">
    const cache = new Map<string, PlaneGeometry>();

    function planeGeometry(textureData: any) {
        const key = textureData.width + 'x' + textureData.height;
        let val = cache.get(key)
        if (!val) {
            val = new PlaneGeometry(textureData.width, textureData.height);
            cache.set(key, val);
        }
        return val;
    }
</script>
<script lang="ts">
    import { Mesh, TransformControls } from '@threlte/core';
    import { MeshStandardMaterial, PlaneGeometry } from 'three';
    import { useDoom, useDoomMap } from '../DoomContext';
    import { EIGHTH_PI, QUARTER_PI, type MapObject, HALF_PI } from '../../doom';
    import Wireframe from '../Debug/Wireframe.svelte';

    export let thing: MapObject;

    const { map } = useDoomMap();
    const { textures, editor, wad } = useDoom();
    const { position: cameraPosition, rotation: cameraRotation } = map.camera;
    const extraLight = map.player.extraLight;

    const { sector, position, sprite, direction } = thing;

    $: ang = Math.atan2($position.y - $cameraPosition.y, $position.x - $cameraPosition.x)
    $: rot = (Math.floor((ang - $direction - EIGHTH_PI) / QUARTER_PI) + 16) % 8 + 1;
    $: frames = wad.spriteFrames($sprite.name);
    $: frame = frames[$sprite.frame][rot] ?? frames[$sprite.frame][0];

    $: texture = textures.get(frame.name, 'sprite');
    $: hOffset = texture.userData.xOffset - (texture.userData.width * .5);
    // Sprite offset is much more complicated than this but this is simple and looks okay-ish.
    // https://www.doomworld.com/forum/topic/110008-what-is-this-bs-with-gl-hardware-mode
    // and https://www.doomworld.com/forum/topic/68145-source-port-sprites-through-the-floor
    const hackedSprites = ['MISL', 'PLSE', 'BFE1', 'BFS1'];
    $: vOffset = Math.max(texture.userData.yOffset - texture.userData.height, 0) + (texture.userData.height * .5);
    $: if (hackedSprites.includes($sprite.name)) {
        vOffset += texture.userData.yOffset - texture.userData.height;
    }

    $: material = new MeshStandardMaterial({ alphaTest: 1, emissive: 'magenta' });
    $: material.emissiveIntensity = ($editor.selected === thing) ? 0.1 : 0;
    $: if (texture) {
        material.map = texture;
    }

    $: if (thing.source.type === 58) {
        // this isn't ideal handling of specters but at least it differentiates them from pink demons
        material.alphaTest = 0;
        material.transparent = true;
        material.opacity = .45;
    }

    $: light = $sector.light;
    $: if ($sprite.fullbright || $light !== undefined) {
        material.color = textures.lightColor($extraLight + ($sprite.fullbright ? 255 : $light));
    }

    function hit() {
        $editor.selected = thing;
    }

    function positionChanged(ev) {
        position.val.x = Math.floor(ev.detail.target.worldPosition.x);
        position.val.y = Math.floor(ev.detail.target.worldPosition.y);
        position.set(position.val);
    }
</script>

<Mesh
    interactive={$editor.active}
    on:click={hit}
    {material}
    geometry={planeGeometry(texture.userData)}
    scale={frame.mirror ? { x: -1 } : {}}
    rotation={{ y: $cameraRotation.z, x: HALF_PI, order:'ZXY' }}
    position={{
        x: $position.x + hOffset,
        y: $position.y + hOffset,
        z: $position.z + vOffset,
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
