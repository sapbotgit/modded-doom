<script lang="ts">
    import { T, useTask } from "@threlte/core";
    import { useAppContext, useDoomMap } from "../../DoomContext";
    import { HALF_PI } from "../../../doom";
    import { tweened } from "svelte/motion";
    import { quadOut } from "svelte/easing";
    import type { Vector3 } from "three";

    export let yScale: number;

    const fov = useAppContext().settings.fov;
    const { map, renderSectors, camera, skyColor: skyColor } = useDoomMap();
    const { position: playerPosition, direction: yaw } = map.player;

    let zoom = 200;
    useTask(() => {
        zoom = Math.max(50, Math.min(1500, zoom + map.game.input.aim.z));
        map.game.input.aim.setZ(0);
    }, { autoInvalidate: false });

    const { position, angle } = camera;
    $: $angle.x = 0;
    $: $angle.z = $yaw - HALF_PI;

    let tz = tweened(0, { easing: quadOut });
    $: $tz = $playerPosition.z;
    $: updatePos($playerPosition, $tz);
    function updatePos(pos: Vector3, pz: number) {
        $position.x = pos.x;
        $position.y = pos.y;
        $position.z = pz + zoom;
    }
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
    scale.y={yScale}
    far={100000}
    fov={$fov}
/>

<!-- this effect looks cheap but kind of fun to play with -->
<T.FogExp2
    color={skyColor}
    density={0.001}
/>