<script lang="ts">
    import type { MapObject } from "../../doom";
    import { ToDegrees } from "../../doom/Math";

    export let player: MapObject;
    const { position, direction } = player;
</script>

<div class="root">
    <div>pos: [x: {$position.x.toFixed(2)}, y: {$position.y.toFixed(2)}, z: {$position.z.toFixed(2)}]</div>
    <div>dir: [{$direction * ToDegrees}]</div>
</div>

<style>
    .root {
        text-align: left;
        background: black;
    }
</style>