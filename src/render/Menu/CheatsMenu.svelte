<script lang="ts">
    import type { PlayerMapObject } from "../../doom";
    import { MapObjectIndex, SoundIndex, mapObjectInfo } from "../../doom";
    import { tweened } from "svelte/motion";
    import { visible } from '../Debug/PlayerInfo.svelte';
    import { idfa, idkfa } from "../Controls/KeyboardCheatControls";

    export let player: PlayerMapObject;
    const { invicibility, noclip, freeFly } = player.map.game.settings;

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
    <input type="checkbox" class="checkbox" bind:checked={$invicibility} />
</label>
<label class="label cursor-pointer flex gap-2">
    <div class="label-text">idclip (walk through walls)</div>
    <input type="checkbox" class="checkbox" bind:checked={$noclip} />
</label>
<label class="label cursor-pointer flex gap-2">
    <div class="label-text">free fly</div>
    <input type="checkbox" class="checkbox" bind:checked={$freeFly} />
</label>
<button class="btn" on:click={() => idfa(player.map.game)}>idfa (full ammo and weapons)</button>
<button class="btn" on:click={() => idkfa(player.map.game)}>idkfa (keys, ammo, and weapons)</button>
<button class="btn" on:click={revive}>Revive</button>
<label class="label cursor-pointer flex gap-2">
    <div class="label-text">Debug player info</div>
    <input type="checkbox" class="checkbox" bind:checked={$visible} />
</label>