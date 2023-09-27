<script lang="ts">
    import { Mesh, useThrelte, type Position } from "@threlte/core";
    import Wireframe from "../Debug/Wireframe.svelte";
    import { MeshStandardMaterial, PlaneGeometry } from "three";
    import type { Sector } from "../../doom";
    import { useDoom, useDoomMap } from "../DoomContext";
    import type { Sprite } from "../../doom/sprite";

    export let sprite: Sprite;
    export let sector: Sector;
    export let position: Position;

    const { camera } = useThrelte();
    $: invYScale = 1 / $camera.scale.y;
    const { textures, wad } = useDoom();
    const { map } = useDoomMap();
    const extraLight = map.player.extraLight;

    $: frames = wad.spriteFrames(sprite.name);
    $: frame = frames[sprite.frame][0];
    $: texture = textures.get(frame.name, 'sprite');
    $: pos = {
        x: position.x - texture.userData.xOffset + (texture.userData.width * .5),
        y: position.y + texture.userData.yOffset - (texture.userData.height * .5),
        z: position.z,
    };

    $: material = new MeshStandardMaterial({ depthTest: false, depthWrite: false, alphaTest: 1 });
    $: if (texture) {
        material.map = texture;
    }

    $: light = sector.light;
    $: if (sprite && (sprite.fullbright || $light !== undefined)) {
        material.color = textures.lightColor(sprite.fullbright ? 255 : $light + $extraLight);
    }
</script>

{#if texture}
    <Mesh
        {material}
        renderOrder={2}
        geometry={new PlaneGeometry(texture.userData.width, texture.userData.height)}
        scale={{ y: invYScale, x: frame.mirror ? -1 : 1 }}
        position={pos}
    >
        <Wireframe />
    </Mesh>
{/if}