<script lang="ts">
    import { Vector3 } from "three";
    import type { PlayerInventory, PlayerMapObject } from "../../doom";
    import { MapObjectIndex, ToDegrees, mapObjectInfo, ticksPerSecond } from "../../doom";
    import { allWeapons } from "../../doom/things/weapons";
    import { tweened } from "svelte/motion";
    import { fly } from "svelte/transition";

    export let player: PlayerMapObject;
    export let interactive = true;
    const { position, direction, velocity, sector, inventory } = player;

    let visible = false;
    let vh: number;
    let subsectors = [];
    $: if ($position) {
        subsectors = []
        player.subsectors(s => subsectors.push(s));
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

    function tickTime(ticks: number) {
        return (ticks / ticksPerSecond).toFixed(2);
    }

    function kfa() {
        return () => {
            fa()();
            updateInv(inv => inv.keys = 'byrBYR')();
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
                w.splice(w.findIndex(e => e.name === 'super shotgun'), 1);
            }
            if (!player.map.game.wad.spriteTextureData('PLSGA0')) {
                // no plasma rifle (shareware doom?)
                w.splice(w.findIndex(e => e.name === 'plasma rifle'), 1);
            }
            if (!player.map.game.wad.spriteTextureData('BFGGA0')) {
                // no BFG (shareware doom?)
                w.splice(w.findIndex(e => e.name === 'bfg'), 1);
            }
            inv.weapons = w;
            inv.armorType = 2;
            inv.armor = 200;
        });
    }

    function revive() {
        // undo effects of MapObject.kill()
        const tw = tweened(player.health.val);
        tw.subscribe(v => player.health.set(v));
        tw.set(100, { duration: 2000 });
        const mInfo = mapObjectInfo[MapObjectIndex.MT_PLAYER];
        player.setState(mInfo.spawnstate);
        player.info.height = mInfo.height;
        player.info.flags = mInfo.flags;
        player.weapon.val.activate(player);
    }

    function invincible() {
        player.map.game.settings.invicibility.update(v => !v);
    }
</script>

<div class="root">
    {#if visible}
        <div
            class="settings bg-base-100 honeycomb shadow-xl"
            class:sloped={!interactive}
            transition:fly={{ y: 200}}
        >
            <div>pos: {vec($position)}</div>
            <div>vel: {vec(velocity)}</div>
            <div>dir: [{($direction * ToDegrees).toFixed(3)}]</div>
            <div>sect: {$sector.num}, [floor, ceil]=[{$sector.zFloor.val}, {$sector.zCeil.val}]</div>
            <div>Sectors: [{[...new Set(subsectors.map(e=>e.sector.num))]}]</div>
            <div>Subsectors: [{subsectors.map(e => e.num)}]</div>
            <div>viewHeight: {vh.toFixed(2)}</div>
            {#if interactive}
                <button class="btn" on:click={revive}>Revive</button>
                <button class="btn" on:click={invincible}>IDDQD</button>
                <button class="btn" on:click={fa()}>FA</button>
                <button class="btn" on:click={kfa()}>KFA</button>
                <div class="bonus">
                    <button class="btn" on:click={() => player.bonusCount.update(val => val + 6)}>bouns flash</button>
                    <button class="btn" on:click={() => player.damageCount.update(val => val + 10)}>hurt flash</button>
                    <button class="btn" on:click={updateInv(inv => inv.items.invincibilityTicks += 4 * ticksPerSecond)}>
                        +4s invuln {tickTime($inventory.items.invincibilityTicks)}</button>
                    <button class="btn" on:click={updateInv(inv => inv.items.radiationSuitTicks += 4 * ticksPerSecond)}>
                        +4s rad suit {tickTime($inventory.items.radiationSuitTicks)}</button>
                    <button class="btn" on:click={updateInv(inv => inv.items.berserkTicks += 4 * ticksPerSecond)}>
                        +4s berserk {tickTime($inventory.items.berserkTicks)}</button>
                    <button class="btn" on:click={updateInv(inv => inv.items.nightVisionTicks += 4 * ticksPerSecond)}>
                        +4s lightamp {tickTime($inventory.items.nightVisionTicks)}</button>
                    <button class="btn" on:click={updateInv(inv => inv.items.invisibilityTicks += 4 * ticksPerSecond)}>
                        +4s invis {tickTime($inventory.items.invisibilityTicks)}</button>
                </div>
                <button class="btn" on:click={() => visible = false}>Hide</button>
            {/if}
        </div>
    {:else if interactive}
        <button class="btn" on:click={() => visible = true}>Player Debug</button>
    {/if}
</div>

<style>
    .root {
        position: absolute;
        right: 0;
        bottom: 0;
        display: grid;
        perspective: 200px;
    }

    .settings {
        transform: scale(1);
        transform-origin: right;
        transition: transform .5s;
    }
    .sloped {
        transform: rotateY(-4deg) scale(0.9);
    }

    .root button {
        height: 3em;
        justify-self: end;
    }

    .settings {
        text-align: left;
        padding-inline-start: 1em;
        padding-inline-end: 1em;
        min-width: 24em;
    }

    .bonus {
        padding-top: .2em;
        gap: 0.2em;
        display: flex;
        flex-direction: column;
    }
</style>