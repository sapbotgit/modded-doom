<script lang="ts" context="module">
    // all things are planes so may as well use the same geometry
    // TODO: actually we can do better than this. We can use instancing per thing type
    // so that we only have one draw call per type. It means we'll need to create a sprite
    // sheet though and uv index to the appropriate frame but it's doable.
    // TODO2: next level... single sprite sheet for all sprites so one draw call for all mobjs?
    const geometry = new PlaneGeometry();
</script>
<script lang="ts">
    import { Mesh, TransformControls } from '@threlte/core';
    import { MeshStandardMaterial, PlaneGeometry, type EulerOrder, ShaderMaterial } from 'three';
    import { useAppContext, useDoom, useDoomMap } from '../DoomContext';
    import { EIGHTH_PI, QUARTER_PI, type MapObject, HALF_PI, MFFlags, normalizeAngle } from '../../doom';
    import { ShadowsShader } from '../Shaders/ShadowsShader';
    import Wireframe from '../Debug/Wireframe.svelte';

    export let thing: MapObject;

    const { map } = useDoomMap();
    const tick = map.game.time.tick;
    const { editor } = useAppContext();
    const { textures, wad } = useDoom();
    const { position: cameraPosition, rotation: cameraRotation, mode } = map.camera;
    const extraLight = map.player.extraLight;

    const { sector, position, sprite, direction, renderShadow } = thing;
    const isPuff = (thing.info.flags & MFFlags.InvertSpriteYOffset);
    const isBillboard = (thing.info.flags & MFFlags.BillboardSprite);

    $: ang = $mode === 'bird' ? $direction : Math.atan2($position.y - $cameraPosition.y, $position.x - $cameraPosition.x);
    $: rot = 8 - Math.floor((EIGHTH_PI + normalizeAngle(ang - $direction)) / QUARTER_PI) % 8;
    $: frames = wad.spriteFrames($sprite.name);
    $: frame = frames[$sprite.frame][rot] ?? frames[$sprite.frame][0];

    $: texture = textures.get(frame.name, 'sprite');
    // TODO: for sprites that don't have equal width on each frame, this causes some "jiggle"
    // most sprites have a consistent width (but not all, consider "burning barrel") so hmmmm
    $: hOffset = -texture.userData.xOffset + (texture.userData.width * .5);
    // Sprite offset is much more complicated than this but this is simple and looks okay-ish.
    // https://www.doomworld.com/forum/topic/110008-what-is-this-bs-with-gl-hardware-mode
    // and https://www.doomworld.com/forum/topic/68145-source-port-sprites-through-the-floor
    const hackedSprites = ['MISL', 'PLSE', 'BFE1', 'BFS1'];
    $: vOffset =
        Math.max(texture.userData.yOffset - texture.userData.height, 0) + (texture.userData.height * .5)
        * (isPuff ? -1 : 1);
    $: if (hackedSprites.includes($sprite.name)) {
        vOffset += texture.userData.yOffset - texture.userData.height;
    }

    $: rotation =
        $mode === 'bird' ? { z: $direction + HALF_PI, y: -Math.PI, x: Math.PI, order: 'ZXY' as EulerOrder } :
        isBillboard ? { x: $cameraRotation.x, z: $cameraRotation.z, order: 'ZXY' as EulerOrder } :
        { y: $cameraRotation.z, x: HALF_PI, order: 'ZXY' as EulerOrder };

    $: material = $renderShadow
        ? new ShaderMaterial({ transparent: true, ...ShadowsShader() })
        : new MeshStandardMaterial({ alphaTest: 1, emissive: 'magenta' });

    $: if (material instanceof MeshStandardMaterial) {
        material.emissiveIntensity = ($editor.selected === thing) ? 0.1 : 0;
    }

    $: if (material instanceof ShaderMaterial && $tick) {
        material.uniforms.time.value = map.game.time.elapsed;
    }

    $: if (texture) {
        if (material instanceof ShaderMaterial) {
            material.uniforms.map.value = texture;
        } else {
            material.map = texture;
        }
    }

    $: light = $sector.light;
    $: if ($sprite.fullbright || $light !== undefined) {
        const col = textures.lightColor($sprite.fullbright ? 255 : $light + $extraLight);
        if (material instanceof ShaderMaterial) {
            material.uniforms.light.value = col;
        } else {
            material.color = col;
        }
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
    userData={{ type: 'mobj', moType: thing.type }}
    interactive={$editor.active}
    on:click={hit}
    {material}
    {geometry}
    scale={{ y: texture.userData.height, x: frame.mirror ? -texture.userData.width : texture.userData.width }}
    {rotation}
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
