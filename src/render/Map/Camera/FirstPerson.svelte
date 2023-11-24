<script lang="ts">
    import { Group, PerspectiveCamera } from "@threlte/core";
    import Weapon from "../Weapon.svelte";
    import { useDoomMap } from "../../DoomContext";
    import { HALF_PI } from "../../../doom";

    export let yScale: number;

    const { map, renderSectors, camera } = useDoomMap();
    const player = map.player;
    const { position: playerPosition, direction: yaw, pitch } = player;
    const { freeFly, cameraMode } = map.game.settings;

    const { position, angle } = camera;
    $: $position.x = $playerPosition.x
    $: $position.y = $playerPosition.y;
    $: $position.z = $playerPosition.z + ($freeFly ? 41 : player.computeViewHeight(map.game.time));

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
        <Weapon {player} />
    </Group>
</PerspectiveCamera>