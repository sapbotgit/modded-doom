<script lang="ts">
    import { Mesh, OrthographicCamera, PerspectiveCamera } from "@threlte/core";
    import Thing from "./Thing.svelte";
    import { CircleGeometry, MeshBasicMaterial } from "three";
    import Weapon from "./Weapon.svelte";
    import { useDoomMap } from "../DoomContext";

    const { map } = useDoomMap();
    const { mode, position: cameraPosition, rotation: cameraRotation } = map.camera;
    const player = map.player;
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