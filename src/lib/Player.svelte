<script lang="ts">
    import { PerspectiveCamera } from "@threlte/core";
    import { useDoom } from "./useDoom";
    import Thing from "./Thing.svelte";
    import { HALF_PI } from "./Math";

    const { game } = useDoom();
    const { position: cameraPosition, rotation: cameraRotation } = game.camera;
</script>

{#if game.input.followCam}
    <Thing thing={game.player} rotation={-HALF_PI} />
{/if}

<PerspectiveCamera
    rotation={$cameraRotation}
    position={$cameraPosition}
    far={100000}
    fov={70}
/>
