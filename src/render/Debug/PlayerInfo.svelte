<script lang="ts">
    import type { MapObject, PlayerMapObject } from "../../doom";
    import { ToDegrees } from "../../doom";

    export let player: MapObject;
    const { position, direction, velocity, sector } = player;
    const { position: cameraPosition } = player.map.camera;
    let vh: number;
    $: if ($cameraPosition) {
        vh = (player as PlayerMapObject).computeViewHeight(player.map.game.time);
    }
</script>

<div class="root">
    <div>pos: [x: {$position.x.toFixed(2)}, y: {$position.y.toFixed(2)}, z: {$position.z.toFixed(2)}]</div>
    <div>vel: [x: {velocity.x.toFixed(2)}, y: {velocity.y.toFixed(2)}, z: {velocity.z.toFixed(2)}]</div>
    <div>dir: [{$direction * ToDegrees}]</div>
    <div>sect: {$sector.num}, [floor, ceil]=[{$sector.zFloor.val}, {$sector.zCeil.val}]</div>
    <div>camera: [x: {$cameraPosition.x.toFixed(2)}, y: {$cameraPosition.y.toFixed(2)}, z: {$cameraPosition.z.toFixed(2)}]</div>
    <div>viewHeight: {vh.toFixed(2)}</div>
</div>

<style>
    .root {
        text-align: left;
        background: black;
    }
</style>