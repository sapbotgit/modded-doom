<script lang="ts">
    import { Mesh, OrthographicCamera, PerspectiveCamera } from "@threlte/core";
    import { useDoom } from "./useDoom";
    import Thing from "./Thing.svelte";
    import { CircleGeometry, MeshBasicMaterial } from "three";
    import Weapon from "./Weapon.svelte";
    import type { PlayerMapObject } from "../doom";

    const { game } = useDoom();
    const { mode, position: cameraPosition, rotation: cameraRotation } = game.camera;
    const player = game.player as PlayerMapObject;
    const { position: playerPosition } = player;

    $: camPos = $cameraPosition;
</script>

{#if $mode !== '1p'}
    <Thing thing={player} />

    <Mesh
        geometry={new CircleGeometry(player.info.radius)}
        position={{ x: $playerPosition.x, y: $playerPosition.y, z: player.sector.val.zFloor.val + 1 }}
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
    >
        {#if $mode === '1p'}
            <Weapon {player} />
        {/if}
    </PerspectiveCamera>
{/if}