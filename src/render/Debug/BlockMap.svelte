<script lang="ts">
    import { GridHelper } from "three";
    import { HALF_PI, type MapRuntime } from "../../doom";
    import { Object3DInstance } from "@threlte/core";
    import { useAppContext } from "../DoomContext";

    export let map: MapRuntime;

    const showBlockmap = useAppContext().settings.showBlockMap;
    const { position: playerPosition } = map.player;

    const bbox = map.data.blockMapBounds;
    const width = bbox.right - bbox.left;
    const height = bbox.top - bbox.bottom;
    const size = Math.max(width, height);
    const gh = new GridHelper(size, Math.ceil(size / 128));
</script>

{#if $showBlockmap}
    <Object3DInstance
        object={gh}
        rotation={{ x: HALF_PI }}
        position={{
            x: bbox.left + size * .5,
            y: bbox.bottom + size * .5,
            z: $playerPosition.z + 1 }}
    />
{/if}
