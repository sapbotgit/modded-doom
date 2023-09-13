<script lang="ts">
    import { weaponTop, type PlayerMapObject } from "../../doom";
    import Sprite from "../Components/WeaponSprite.svelte";

    export let player: PlayerMapObject;

    const { sector, weapon } = player;

    $: sprite = $weapon.sprite;
    // base x, y and z values are from a little trial and error.
    // x: as -160 makes sense because the screen was 320 wide
    // y: 32 is because weapon top is 32.
    // z: ... not sure. It looked about right
    $: wOffset = $weapon.position;
    $: position = {
        x: $wOffset.x - 160,
        y: $wOffset.y + weaponTop,
        z: -148,
    }

    // flash
    $: flashSprite = $weapon.flashSprite;
</script>

<Sprite
    sprite={$sprite}
    sector={$sector}
    {position}
/>
{#if $flashSprite}
    <Sprite
        sprite={$flashSprite}
        sector={$sector}
        {position}
    />
{/if}
