<script lang="ts">
    import { Mesh } from "@threlte/core";
    import { MeshStandardMaterial, PlaneGeometry } from "three";
    import { useDoom } from "./DoomContext";
    import Wireframe from "./Debug/Wireframe.svelte";
    import { weaponTop, type PlayerMapObject, HALF_PI } from "../doom";

    export let player: PlayerMapObject;

    const { textures, wad, game } = useDoom();
    const { sector, weapon } = player;
    const tick = game.time.tick;

    $: sprite = $weapon.sprite;
    $: frames = $sprite && wad.spriteFrames($sprite.name);
    $: frame = $sprite && frames[$sprite.frame][0];
    $: texture = $sprite && textures.get(frame.name, 'sprite');
    // base x, y and z values are from a little trial and error.
    // x: as -160 makes sense because the screen was 320 wide
    // y: 32 is because weapon top is 32.
    // z: ... not sure. It looked about right
    $: wOffset = $weapon.position;
    $: position = $sprite && {
        x: $wOffset.x - texture.userData.xOffset + (texture.userData.width * .5) - 160,
        y: $wOffset.y + texture.userData.yOffset - (texture.userData.height * .5) + weaponTop,
        z: -148,
    };

    $: material = new MeshStandardMaterial({ depthTest: false, depthWrite: false, alphaTest: 1 });
    $: if (texture) {
        material.map = texture;
    }

    $: light = $sector.light;
    $: if ($sprite && ($sprite.fullbright || $light !== undefined)) {
        material.color = textures.lightColor($sprite.fullbright ? 255 : $light);
    }

    // flash
    // TODO: lots of repition here (and partially with Thing.svelte too). Maybe we need a Sprite.svelte component?
    $: flashSprite = $weapon.flashSprite;
    $: flashFrames = $flashSprite && wad.spriteFrames($flashSprite.name);
    $: flashFrame = $flashSprite && flashFrames[$flashSprite.frame][0];
    $: flashTexture = $flashSprite && textures.get(flashFrame.name, 'sprite');
    $: flashWOffset = $weapon.position;
    $: flashPosition = $flashSprite && {
        x: $flashWOffset.x - flashTexture.userData.xOffset + (flashTexture.userData.width * .5) - 160,
        y: $flashWOffset.y + flashTexture.userData.yOffset - (flashTexture.userData.height * .5) + weaponTop,
        z: -148,
    };

    $: flashMaterial = new MeshStandardMaterial({ depthTest: false, depthWrite: false, alphaTest: 1 });
    $: if (flashTexture) {
        flashMaterial.map = flashTexture;
    }

    $: flashLight = $sector.light;
    $: if ($flashSprite && ($flashSprite.fullbright || $light !== undefined)) {
        flashMaterial.color = textures.lightColor($flashSprite.fullbright ? 255 : $flashLight);
    }
</script>

{#if texture}
    <Mesh
        {material}
        renderOrder={2}
        geometry={new PlaneGeometry(texture.userData.width, texture.userData.height)}
        scale={frame.mirror ? { x: -1 } : {}}
        {position}
    >
        <Wireframe />
    </Mesh>

    {#if flashTexture}
        <Mesh
            material={flashMaterial}
            renderOrder={2}
            geometry={new PlaneGeometry(flashTexture.userData.width, flashTexture.userData.height)}
            scale={flashFrame.mirror ? { x: -1 } : {}}
            position={flashPosition}
        >
            <Wireframe />
        </Mesh>
    {/if}
{/if}