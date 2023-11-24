<script lang="ts">
    import { Group, PerspectiveCamera, useFrame } from "@threlte/core";
    import Weapon from "../Weapon.svelte";
    import { useDoomMap } from "../../DoomContext";
    import { HALF_PI } from "../../../doom";
    import { Vector3 } from "three";
    import { tweened } from "svelte/motion";
    import { quadOut } from "svelte/easing";

    export let yScale: number;

    const { map, renderSectors, camera } = useDoomMap();
    const player = map.player;
    const { position: playerPosition, direction: yaw, pitch } = player;
    const { cameraMode } = map.game.settings;

    const { position, angle } = camera;
    $: $angle.x = $pitch + HALF_PI;
    $: $angle.z = $yaw - HALF_PI;

    let followHeight = 46;
    let shoulderOffset = -10;
    let zoom = 50;
    let tz = tweened(0, { easing: quadOut });
    $: $tz = $playerPosition.z;
    useFrame(() => {
        zoom = Math.max(10, Math.min(100, zoom + map.game.input.aim.z));
        map.game.input.aim.setZ(0);

        $position.x = -Math.sin(-$angle.x) * -Math.sin(-$angle.z) * zoom + $playerPosition.x + shoulderOffset * Math.cos($angle.z);
        $position.y = -Math.sin(-$angle.x) * -Math.cos(-$angle.z) * zoom + $playerPosition.y + shoulderOffset * Math.sin($angle.z);
        $position.z = Math.cos($angle.x) * zoom + $tz + followHeight;

        if ($cameraMode === '3p') {
            clipPosition($position);
        }
    });

    const _ppos = new Vector3();
    const _3pDir = new Vector3();
    function clipPosition(pos: Vector3) {
        // clip to walls and ceiling/floor
        _ppos.copy($playerPosition).setZ($playerPosition.z + followHeight);
        _3pDir.copy(pos).sub(_ppos);
        map.data.traceRay(_ppos, _3pDir, hit => {
            if ('mobj' in hit) {
                return true;
            }
            if ('line' in hit && hit.line.left) {
                const ceil = Math.min(hit.line.left.sector.zCeil.val, hit.line.right.sector.zCeil.val);
                const floor = Math.max(hit.line.left.sector.zFloor.val, hit.line.right.sector.zFloor.val);
                const gap = ceil - floor;
                if (gap > 0 && floor - _ppos.z < -20) {
                    return true; // two-sided but there is a gap for the camera so keep searching
                }
            }
            pos.copy(_ppos).addScaledVector(_3pDir, hit.fraction * .9);
            return false;
        });
    }
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