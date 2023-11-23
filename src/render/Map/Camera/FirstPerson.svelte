<script lang="ts">
    import { Group, PerspectiveCamera, useFrame } from "@threlte/core";
    import Weapon from "../Weapon.svelte";
    import { useDoomMap } from "../../DoomContext";
    import type { EulerOrder } from "three";
    import { HALF_PI } from "../../../doom";

    export let yScale: number;

    const { map, renderSectors, camera } = useDoomMap();
    const player = map.player;
    const { freeFly, cameraMode } = map.game.settings;
    const { position: playerPosition, direction: yaw, pitch } = map.player;

    const { position, angle } = camera;
    $: $position.x = $playerPosition.x
    $: $position.y = $playerPosition.y;
    useFrame(() => {
        const playerViewHeight = $freeFly ? 41 : player.computeViewHeight(map.game.time);
        $position.z = $playerPosition.z + playerViewHeight;
    });

    $: $angle.x = $pitch + HALF_PI;
    $: $angle.z = $yaw - HALF_PI;
</script>

<PerspectiveCamera
    rotation={$angle}
    position={$position}
    far={100000}
    fov={72}
    scale={{ y: yScale }}
    >
    <Group scale={{ y: 1 / yScale }}>
        {#if $cameraMode === "1p"}
            <Weapon {player} />
        {/if}
    </Group>
</PerspectiveCamera>