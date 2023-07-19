<script lang="ts">
    import { GridHelper } from "three";
    import { useDoom } from "../useDoom";
    import type { DoomMap } from "../../doom";
    import { Object3DInstance } from "@threlte/core";
    import { HALF_PI } from "../../doom/Math";

    export let map: DoomMap;

    const showBlockmap = true;

    const { game } = useDoom();
    const { position: playerPosition } = game.player;

    const bbox = map.blockmap.bounds;
    const width = bbox.right - bbox.left;
    const height = bbox.top - bbox.bottom;
    const size = Math.max(width, height);
    const gh = new GridHelper(size, Math.ceil(size / 128));
</script>

{#if showBlockmap}
    <Object3DInstance
        object={gh}
        rotation={{ x: HALF_PI }}
        position={{ x: bbox.left + width * .5, y: bbox.top - height * .5, z: $playerPosition.z + 5 }}
    />
{/if}
