<script lang="ts">
    import { GridHelper } from "three";
    import { HALF_PI, type MapRuntime } from "../../doom";
    import { Object3DInstance } from "@threlte/core";

    export let map: MapRuntime;

    const showBlockmap = false;

    const { position: playerPosition } = map.player;

    const bbox = map.data.blockmap.bounds;
    const width = bbox.right - bbox.left;
    const height = bbox.top - bbox.bottom;
    const size = Math.max(width, height);
    const gh = new GridHelper(size, Math.ceil(size / 128));
</script>

{#if showBlockmap}
    <Object3DInstance
        object={gh}
        rotation={{ x: HALF_PI }}
        position={{
            x: bbox.left + width * .5,
            y: bbox.bottom + height * .5,
            z: $playerPosition.z + 1 }}
    />
{/if}
