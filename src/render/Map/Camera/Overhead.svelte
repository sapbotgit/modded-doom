<script lang="ts">
    import { FogExp2, PerspectiveCamera, useFrame } from "@threlte/core";
    import { useDoomMap } from "../../DoomContext";
    import { HALF_PI } from "../../../doom";
    import { tweened } from "svelte/motion";
    import { quadOut } from "svelte/easing";

    export let yScale: number;

    const { map, renderSectors, camera, skyColor: skyColor } = useDoomMap();
    const { position: playerPosition, direction: yaw } = map.player;

    let zoom = 200;
    let tz = tweened(0, { easing: quadOut });
    $: $tz = $playerPosition.z;
    useFrame(() => {
        zoom = Math.max(50, Math.min(1500, zoom + map.game.input.aim.z));
        map.game.input.aim.setZ(0);
        $position.z = $tz + zoom;
    });

    const { position, angle } = camera;
    $: $position.x = $playerPosition.x;
    $: $position.y = $playerPosition.y;

    $: $angle.x = 0;
    $: $angle.z = $yaw - HALF_PI;
</script>

<PerspectiveCamera
    rotation={$angle}
    position={$position}
    far={100000}
    fov={72}
    scale={{ y: yScale }}
/>

<!-- this effect looks cheap but kind of fun to play with -->
<FogExp2
    color={skyColor}
    density={0.001}
/>