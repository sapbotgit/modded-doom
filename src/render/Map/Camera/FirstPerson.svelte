<script lang="ts">
    import { T } from "@threlte/core";
    import { useAppContext, useDoomMap } from "../../DoomContext";
    import { HALF_PI } from "../../../doom";

    export let yScale: number;

    // TODO: most cameras (except ortho) only differ by how they set position and angle. We should consolidate
    const fov = useAppContext().settings.fov;
    const { map, renderSectors, camera } = useDoomMap();
    const player = map.player;
    const { position: playerPosition, direction: yaw, pitch, viewHeight } = player;

    const { position, angle } = camera;
    // If we useTask() here, then there is one frame that is rendered before $position is setup correctly.
    $: $position.x = $playerPosition.x;
    $: $position.y = $playerPosition.y;
    $: $position.z = $playerPosition.z + $viewHeight;

    $: $angle.x = $pitch + HALF_PI;
    $: $angle.z = $yaw - HALF_PI;
</script>

<T.PerspectiveCamera
    makeDefault
    rotation.x={$angle.x}
    rotation.y={$angle.y}
    rotation.z={$angle.z}
    rotation.order={$angle.order}
    position.x={$position.x}
    position.y={$position.y}
    position.z={$position.z}
    far={100000}
    fov={$fov}
    scale.y={yScale}
/>
