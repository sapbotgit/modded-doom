<script lang="ts">
    import { Vector3 } from "three";
    import type { PlayerInventory, PlayerMapObject } from "../../doom";
    import { MapObjectIndex, ToDegrees, mapObjectInfo, ticksPerSecond } from "../../doom";
    import { allWeapons } from "../../doom/things/weapons";
    import { tweened } from "svelte/motion";
    export let player: PlayerMapObject;
    const { position, direction, velocity, sector, inventory } = player;
    const { position: cameraPosition } = player.map.camera;
    let vh: number;
    $: if ($cameraPosition) {
        vh = player.computeViewHeight(player.map.game.time);
    }

    let subsectors = [];
    $: if ($position) {
        subsectors = []
        player.subsectors(s => subsectors.push(s));
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

    function tickTime(ticks: number) {
        return (ticks / ticksPerSecond).toFixed(2);
    }

    function kfa() {
        return () => {
            fa()();
            updateInv(inv => inv.keys = 'BYR')();
        };
    }

    function fa() {
        return updateInv(inv => {
            for (const t of Object.keys(inv.ammo)) {
                inv.ammo[t].amount = inv.ammo[t].max;
            }
            let w = [...allWeapons];
            if (!player.map.game.wad.spriteTextureData('SHT2A0')) {
                // no super shotgun in this wad so remove it from the weapon list
                w.splice(3, 1);
            }
            inv.weapons = w;
            inv.armorType = 2;
            inv.armor = 200;
        });
    }

    function revive() {
        // undo effects of MapObject.kill()
        const tw = tweened(0);
        tw.subscribe(v => player.health.set(v));
        tw.set(100, { duration: 2000 });
        const mInfo = mapObjectInfo[MapObjectIndex.MT_PLAYER];
        player.setState(mInfo.spawnstate);
        player.info.radius = mInfo.radius;
        player.info.height = mInfo.height;
        player.info.flags = mInfo.flags;
        player.weapon.val.activate(player);
    }

    function invincible() {
        player.map.game.settings.invicibility.update(v => !v);
    }
</script>

<div class="root">
    <div>pos: {vec($position)}</div>
    <div>vel: {vec(velocity)}</div>
    <div>dir: [{($direction * ToDegrees).toFixed(3)}]</div>
    <div>sect: {$sector.num}, [floor, ceil]=[{$sector.zFloor.val}, {$sector.zCeil.val}]</div>
    <div>Sectors: [{[...new Set(subsectors.map(e=>e.sector.num))]}]</div>
    <div>Subsectors: [{subsectors.map(e => e.num)}]</div>
    <div>camera: {vec($cameraPosition)}</div>
    <div>viewHeight: {vh.toFixed(2)}</div>
    <button on:click={revive}>Revive</button>
    <button on:click={invincible}>IDDQD</button>
    <button on:click={fa()}>FA</button>
    <button on:click={kfa()}>KFA</button>
    <div class="bonus">
        <button on:click={() => player.bonusCount.update(val => val + 6)}>bouns flash</button>
        <button on:click={() => player.damageCount.update(val => val + 10)}>hurt flash</button>
        <button on:click={updateInv(inv => inv.items.invincibilityTicks += 4 * ticksPerSecond)}>
            +4s invuln {tickTime($inventory.items.invincibilityTicks)}</button>
        <button on:click={updateInv(inv => inv.items.radiationSuitTicks += 4 * ticksPerSecond)}>
            +4s rad suit {tickTime($inventory.items.radiationSuitTicks)}</button>
        <button on:click={updateInv(inv => inv.items.berserkTicks += 4 * ticksPerSecond)}>
            +4s berserk {tickTime($inventory.items.berserkTicks)}</button>
        <button on:click={updateInv(inv => inv.items.nightVisionTicks += 4 * ticksPerSecond)}>
            +4s lightamp {tickTime($inventory.items.nightVisionTicks)}</button>
        <button on:click={updateInv(inv => inv.items.invisibilityTicks += 4 * ticksPerSecond)}>
            +4s invis {tickTime($inventory.items.invisibilityTicks)}</button>
    </div>
</div>

<style>
    .root {
        text-align: left;
        background: black;
        min-width: 24em;
    }

    .bonus {
        padding-top: .2em;
        gap: 0.2em;
        display: flex;
        flex-direction: column;
    }
</style>