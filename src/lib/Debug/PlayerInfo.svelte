<script lang="ts">
    import type { MapObject } from "../../doom";
    import { ToDegrees } from "../../doom";

    export let player: MapObject;
    const { position, direction, velocity, sector } = player;
</script>

<div class="root">
    <div>pos: [x: {$position.x.toFixed(2)}, y: {$position.y.toFixed(2)}, z: {$position.z.toFixed(2)}]</div>
    <div>vel: [x: {velocity.x.toFixed(2)}, y: {velocity.y.toFixed(2)}, z: {velocity.z.toFixed(2)}]</div>
    <div>dir: [{$direction * ToDegrees}]</div>
    <div>sect: {$sector.num}: {$sector.zFloor.val}, {$sector.zCeil.val}</div>
</div>

<style>
    .root {
        text-align: left;
        background: black;
    }
</style>