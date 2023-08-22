<script lang="ts">
    import { Mesh } from "@threlte/core";
    import { MeshStandardMaterial, PlaneGeometry } from "three";
    import { useDoom } from "./useDoom";
    import Wireframe from "./Debug/Wireframe.svelte";
    import { weapons, type PlayerMapObject } from "../doom";

    export let player: PlayerMapObject;

    const { textures, wad } = useDoom();
    const { sector, weapon } = player;

    $: sprite = $weapon.sprite;
    $: frames = $sprite && wad.spriteFrames($sprite.name);
    $: frame = $sprite && frames[$sprite.frame][0];
    $: texture = $sprite && textures.get(frame.name, 'sprite');
    // base x, y and z values are from a little trial and error
    // Also... fists seem to need a different base x value (not sure why)
    $: wOffset = $weapon.position;
    $: position = $sprite && {
        x: $wOffset.x + texture.userData.xOffset - (texture.userData.width * .5) + ($weapon === weapons[1] ? 250 : 160),
        y: $wOffset.y + texture.userData.yOffset - (texture.userData.height * .5) + 30,
        z: -150,
    };

    $: material = new MeshStandardMaterial({ depthTest: false, depthWrite: false, alphaTest: 1 });
    $: if (texture) {
        material.map = texture;
    }

    $: light = $sector.light;
    $: if ($sprite && ($sprite.fullbright || $light !== undefined)) {
        material.color = textures.lightColor($sprite.fullbright ? 255 : $light);
    }
</script>

{#if texture}
    <Mesh
        {material}
        renderOrder={1}
        geometry={new PlaneGeometry(texture.userData.width, texture.userData.height)}
        scale={frame.mirror ? { x: -1 } : {}}
        {position}
    >
        <Wireframe />
    </Mesh>
{/if}