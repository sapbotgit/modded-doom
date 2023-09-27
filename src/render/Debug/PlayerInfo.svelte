<script lang="ts">
    import { Vector3 } from "three";
    import type { PlayerInventory, PlayerMapObject } from "../../doom";
    import { ToDegrees, ticksPerSecond, weapons } from "../../doom";

    export let player: PlayerMapObject;
    const { position, direction, velocity, sector, inventory } = player;
    const { position: cameraPosition } = player.map.camera;
    let vh: number;
    $: if ($cameraPosition) {
        vh = player.computeViewHeight(player.map.game.time);
    }

    function vec(v: Vector3) {
        return `[x: ${v.x.toFixed(2)}, y: ${v.y.toFixed(2)}, z: ${v.z.toFixed(2)}]`;
    }

    function updateInv(fn: (inv: PlayerInventory) => void) {
        return () => {
            inventory.update(inv => {
                fn(inv);
                return inv;
            });
        }
    }

    function kfa() {
        return () => {
            fa()();
            updateInv(inv => inv.keys = 'RYB')();
        };
    }

    function fa() {
        return updateInv(inv => {
            for (const t of Object.keys(inv.ammo)) {
                inv.ammo[t].amount = inv.ammo[t].max;
            }
            let w = Object.values(weapons);
            w.splice(3, 1);
            inv.weapons = w;
        });
    }
</script>

<div class="root">
    <div>pos: {vec($position)}</div>
    <div>vel: {vec(velocity)}</div>
    <div>dir: [{($direction * ToDegrees).toFixed(3)}]</div>
    <div>sect: {$sector.num}, [floor, ceil]=[{$sector.zFloor.val}, {$sector.zCeil.val}]</div>
    <div>camera: {vec($cameraPosition)}</div>
    <div>viewHeight: {vh.toFixed(2)}</div>
    <div>inv: {JSON.stringify({
        ...$inventory.items,
        armorType: $inventory.armorType,
    }, null, '  ')}</div>
    <button on:click={() => player.bonusCount.update(val => val + 6)}>Add bonus</button>
    <button on:click={() => player.damageCount.update(val => val + 10)}>Hurt (sim)</button>
    <button on:click={updateInv(inv => inv.items.invincibilityTicks += 4 * ticksPerSecond)}>+4s invuln</button>
    <button on:click={updateInv(inv => inv.items.radiationSuitTicks += 4 * ticksPerSecond)}>+4s radiation suit</button>
    <button on:click={updateInv(inv => inv.items.berserkTicks += 4 * ticksPerSecond)}>+4s berserk</button>
    <button on:click={fa()}>FA</button>
    <button on:click={kfa()}>KFA</button>
</div>

<style>
    .root {
        text-align: left;
        background: black;
    }
</style>