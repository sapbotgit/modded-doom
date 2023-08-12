<script lang="ts">
    import { Mesh, OrthographicCamera, PerspectiveCamera } from "@threlte/core";
    import { useDoom } from "./useDoom";
    import Thing from "./Thing.svelte";
    import { CircleGeometry, MeshBasicMaterial } from "three";

    const { game } = useDoom();
    const { mode, position: cameraPosition, rotation: cameraRotation } = game.camera;
    const { position: playerPosition } = game.player;

    $: camPos = $cameraPosition;
</script>

{#if $mode !== '1p'}
    <Thing thing={game.player} />

    <Mesh
        geometry={new CircleGeometry(game.player.spec.mo.radius)}
        position={{ x: $playerPosition.x, y: $playerPosition.y, z: $playerPosition.z + 1 }}
        material={new MeshBasicMaterial({ color: 'green' })}
    />
{/if}

{#if $mode === 'ortho'}
    <OrthographicCamera
        rotation={$cameraRotation}
        position={camPos}
        far={100000}
    />
{:else}
    <PerspectiveCamera
        rotation={$cameraRotation}
        position={camPos}
        far={100000}
        fov={70}
    />
{/if}