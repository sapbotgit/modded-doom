<script lang="ts">
    import type { PlayerInventory, PlayerMapObject } from "../../doom";
    import { MapObjectIndex, SoundIndex, mapObjectInfo } from "../../doom";
    import { allWeapons } from "../../doom/things/weapons";
    import { tweened } from "svelte/motion";
    import { visible } from '../Debug/PlayerInfo.svelte';

    export let player: PlayerMapObject;
    const { inventory } = player;
    const { invicibility, noclip, freeFly } = player.map.game.settings;

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
        // spawn a dead player where we revived (DSDA Doom at least has this behaviour and it's cool)
        player.map.spawn(MapObjectIndex.MT_MISC62, player.position.val.x, player.position.val.y);
        player.map.game.playSound(SoundIndex.sfx_slop, player);
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
</script>

<label class="label cursor-pointer flex gap-2">
    <div class="label-text">iddqd (invicibility)</div>
    <input type="checkbox" class="checkbox checkbox-primary" bind:checked={$invicibility} />
</label>
<label class="label cursor-pointer flex gap-2">
    <div class="label-text">idclip (walk through walls)</div>
    <input type="checkbox" class="checkbox checkbox-primary" bind:checked={$noclip} />
</label>
<label class="label cursor-pointer flex gap-2">
    <div class="label-text">free fly</div>
    <input type="checkbox" class="checkbox checkbox-primary" bind:checked={$freeFly} />
</label>
<button class="btn" on:click={fa()}>idfa (full ammo and weapons)</button>
<button class="btn" on:click={kfa()}>idkfa (keys, ammo, and weapons)</button>
<button class="btn" on:click={revive}>Revive</button>
<label class="label cursor-pointer flex gap-2">
    <div class="label-text">Debug player info</div>
    <input type="checkbox" class="checkbox checkbox-primary" bind:checked={$visible} />
</label>