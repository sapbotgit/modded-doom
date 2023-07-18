<script lang="ts">
    import { Mesh, PerspectiveCamera } from "@threlte/core";
    import { useDoom } from "./useDoom";
    import Thing from "./Thing.svelte";
    import { HALF_PI } from "./Math";
    import { CircleGeometry, MeshBasicMaterial } from "three";

    const { game } = useDoom();
    const { mode, position: cameraPosition, rotation: cameraRotation } = game.camera;
    const { position: playerPosition } = game.player;
</script>

{#if $mode !== '1p'}
    <Thing thing={game.player} rotation={-HALF_PI} />

    <Mesh
        geometry={new CircleGeometry(game.player.spec.mo.radius)}
        position={{ x: $playerPosition.x, y: $playerPosition.y, z: $playerPosition.z + 1 }}
        material={new MeshBasicMaterial({ color: 'green' })}
    />
{/if}

<PerspectiveCamera
    rotation={$cameraRotation}
    position={$cameraPosition}
    far={100000}
    fov={70}
/>
