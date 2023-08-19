<script lang="ts">
    import type { PlayerMapObject } from "../../doom";
    import DoomPic from "../DoomPic.svelte";
    import BigNum from "./BigNum.svelte";
    import { useDoom } from "../useDoom";
    import SmallNum from "./SmallNum.svelte";
    import Face from "./Face.svelte";
    import KeyCard from "./KeyCard.svelte";

    export let player: PlayerMapObject;
    const inv = player.inventory;
    const { health } = player;

    const { wad } = useDoom();
    const background = wad.graphic('STBAR') as any;
    const armsBackground = wad.graphic('STARMS') as any;
    $: ammoType =
        ($inv.weapons[2] || $inv.weapons[4]) ? 'bullets' :
        ($inv.weapons[3]) ? 'shells' :
        ($inv.weapons[5]) ? 'rockets' :
        ($inv.weapons[6] || $inv.weapons[7]) ? 'cells' :
        'none';
    $: ammo = ammoType in $inv ? $inv[ammoType] : null;
</script>

<div class="root">
    <DoomPic data={background} />
    <div class="ammo">
        {#if ammo !== null}
            <BigNum value={ammo} />
        {/if}
    </div>
    <div class="health">
        <BigNum value={$health} percent />
    </div>
    <div class="arms">
        <DoomPic data={armsBackground} />
        <span><SmallNum value={2} altNum={!$inv.weapons[2]} /></span>
        <span><SmallNum value={3} altNum={!$inv.weapons[3]} /></span>
        <span><SmallNum value={4} altNum={!$inv.weapons[4]} /></span>
        <span><SmallNum value={5} altNum={!$inv.weapons[5]} /></span>
        <span><SmallNum value={6} altNum={!$inv.weapons[6]} /></span>
        <span><SmallNum value={7} altNum={!$inv.weapons[7]} /></span>
    </div>
    <div class="face">
        <Face {player} />
    </div>
    <div class="armor">
        <BigNum value={$inv.armor} percent />
    </div>
    <div class="keys">
        {#if $inv.keys.length > 0}
            <span><KeyCard key={$inv.keys[0]} /></span>
        {/if}
        {#if $inv.keys.length > 1}
            <span><KeyCard key={$inv.keys[1]} /></span>
        {/if}
        {#if $inv.keys.length > 2}
            <span><KeyCard key={$inv.keys[2]} /></span>
        {/if}
    </div>
    <div class="backpack">
        <span>
            <SmallNum value={$inv.ammo.bullets.amount} />
            <SmallNum value={$inv.ammo.bullets.max} />
        </span>
        <span>
            <SmallNum value={$inv.ammo.shells.amount} />
            <SmallNum value={$inv.ammo.shells.max} />
        </span>
        <span>
            <SmallNum value={$inv.ammo.rockets.amount} />
            <SmallNum value={$inv.ammo.rockets.max} />
        </span>
        <span>
            <SmallNum value={$inv.ammo.cells.amount} />
            <SmallNum value={$inv.ammo.cells.max} />
        </span>
    </div>
</div>

<style>
    div {
        position: absolute;
        top: 0px;
        display: inline-block;
    }

    .root {
        position: relative;
        transform: scale(2) translate(0px, 25%) ;
    }

    .ammo {
        left: -4px;
        top: 3px;
    }

    .health {
        left: 38px;
        top: 3px;
    }

    .arms {
        top: 0px;
        left: 104px;
    }
    .arms span {
        position: absolute;
    }
    .arms span:nth-child(2) {
        top: -6px;
        left: -1px;
    }
    .arms span:nth-child(3) {
        top: -6px;
        left: 11px;
    }
    .arms span:nth-child(4) {
        top: -6px;
        left: 22.5px;
    }
    .arms span:nth-child(5) {
        top: 4px;
        left: -1px;
    }
    .arms span:nth-child(6) {
        top: 4px;
        left: 11px;
    }
    .arms span:nth-child(7) {
        top: 4px;
        left: 22.5px;
    }

    .face {
        top: 2px;
        left: 148px;
    }

    .armor {
        left: 170px;
        top: 3px;
    }

    .keys {
        top: 1px;
        left: 146px;
    }
    .keys span {
        position: relative;
    }
    .keys span:nth-child(1) {
        top: -7px;
        left: 93px;
    }
    .keys span:nth-child(2) {
        top: 2px;
        left: 82px;
    }
    .keys span:nth-child(3) {
        top: 13px;
        left: 71px;
    }

    .backpack {
        display: inline-flex;
        flex-direction: column;
        left: 250px;
        top: 0px;
    }
    .backpack span {
        position: absolute;
        display: flex;
        flex-direction: row;
        gap: 10px;
    }
    .backpack span:nth-child(1) {
        top: 5px;
        left: 28px;
    }
    .backpack span:nth-child(2) {
        top: 11px;
        left: 28px;
    }
    .backpack span:nth-child(3) {
        top: 17px;
        left: 28px;
    }
    .backpack span:nth-child(4) {
        top: 23px;
        left: 28px;
    }
</style>