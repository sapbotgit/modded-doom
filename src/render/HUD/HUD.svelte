<script lang="ts">
    import type { PlayerMapObject } from "../../doom";
    import Picture from "../Components/Picture.svelte";
    import BigNum from "./BigNum.svelte";
    import SmallNum from "./SmallNum.svelte";
    import Face from "./Face.svelte";
    import KeyCard from "./KeyCard.svelte";
    import type { Size } from "@threlte/core";
    import HUDMessages from "./HUDMessages.svelte";

    export let player: PlayerMapObject;
    export let size: Size;

    const { health, weapon, inventory } = player;
    const hudHeight = player.map.game.wad.graphic('STBAR').height * 2; // why *2? Because we are scaling by 2 in a css transform below
    $: weaponLights = $inventory.weapons.map(e => e?.keynum);
</script>

<HUDMessages {player} />

<div class="root" style="top:{size.height - hudHeight}px">
    <Picture name={'STBAR'} />
    <div class="ammo">
        {#if $inventory.ammo[$weapon.ammoType]}
            <BigNum value={$inventory.ammo[$weapon.ammoType].amount} />
        {/if}
    </div>
    <div class="health">
        <BigNum value={$health} percent />
    </div>
    <div class="arms">
        <Picture name={'STARMS'} />
        <span><SmallNum value={2} altNum={!weaponLights.includes(2)} /></span>
        <span><SmallNum value={3} altNum={!weaponLights.includes(3)} /></span>
        <span><SmallNum value={4} altNum={!weaponLights.includes(4)} /></span>
        <span><SmallNum value={5} altNum={!weaponLights.includes(5)} /></span>
        <span><SmallNum value={6} altNum={!weaponLights.includes(6)} /></span>
        <span><SmallNum value={7} altNum={!weaponLights.includes(7)} /></span>
    </div>
    <div class="face">
        <Face {player} />
    </div>
    <div class="armor">
        <BigNum value={$inventory.armor} percent />
    </div>
    <div class="keys">
        {#if $inventory.keys.includes('B') || $inventory.keys.includes('b')}
            <span><KeyCard keys={$inventory.keys} key={'B'} /></span>
        {/if}
        {#if  $inventory.keys.includes('Y') || $inventory.keys.includes('y')}
            <span><KeyCard keys={$inventory.keys} key={'Y'} /></span>
        {/if}
        {#if  $inventory.keys.includes('R') || $inventory.keys.includes('r')}
            <span><KeyCard keys={$inventory.keys} key={'R'} /></span>
        {/if}
    </div>
    <div class="backpack">
        <span>
            <SmallNum value={$inventory.ammo.bullets.amount} />
            <SmallNum value={$inventory.ammo.bullets.max} />
        </span>
        <span>
            <SmallNum value={$inventory.ammo.shells.amount} />
            <SmallNum value={$inventory.ammo.shells.max} />
        </span>
        <span>
            <SmallNum value={$inventory.ammo.rockets.amount} />
            <SmallNum value={$inventory.ammo.rockets.max} />
        </span>
        <span>
            <SmallNum value={$inventory.ammo.cells.amount} />
            <SmallNum value={$inventory.ammo.cells.max} />
        </span>
    </div>
</div>

<style>
    div {
        position: absolute;
        top: 0px;
        display: inline-block;
        line-height: 0;
    }

    .root {
        align-self: center;
        width: 320px;
        transform: scale(2);
        transform-origin: top center;
    }

    .ammo {
        left: -4px;
        top: 3px;
    }

    .health {
        left: 39px;
        top: 3px;
    }

    .arms {
        display: inline-flex;
        flex-direction: row;
        left: 104px;
        top: 0px;
    }
    .arms span {
        position: absolute;
    }
    .arms span:nth-child(2) {
        top: 4px;
        left: -1px;
    }
    .arms span:nth-child(3) {
        top: 4px;
        left: 11px;
    }
    .arms span:nth-child(4) {
        top: 4px;
        left: 22.5px;
    }
    .arms span:nth-child(5) {
        top: 14px;
        left: -1px;
    }
    .arms span:nth-child(6) {
        top: 14px;
        left: 11px;
    }
    .arms span:nth-child(7) {
        top: 14px;
        left: 22.5px;
    }

    .face {
        top: 2px;
        left: 148px;
    }

    .armor {
        left: 171px;
        top: 3px;
    }

    .keys {
        left: 238.5px;
    }
    .keys span {
        width: 7px;
        position: absolute;
    }
    .keys span:nth-child(1) {
        top: 3px;
    }
    .keys span:nth-child(2) {
        top: 13px;
    }
    .keys span:nth-child(3) {
        top: 23px;
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
        gap: 12px;
    }
    .backpack span:nth-child(1) {
        top: 5px;
        left: 27px;
    }
    .backpack span:nth-child(2) {
        top: 11px;
        left: 27px;
    }
    .backpack span:nth-child(3) {
        top: 17px;
        left: 27px;
    }
    .backpack span:nth-child(4) {
        top: 23px;
        left: 27px;
    }
</style>