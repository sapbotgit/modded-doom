<script lang="ts">
    import { weaponTop, type PlayerMapObject } from "../../doom";
    import WeaponSprite from "../Components/WeaponSprite.svelte";

    export let player: PlayerMapObject;

    const { sector, weapon } = player;

    $: sprite = $weapon.sprite;
    $: flashSprite = $weapon.flashSprite;
    // base x, y and z values are from a little trial and error.
    // x: as -160 makes sense because the screen was 320 wide
    // y: 32 is because weapon top is 32.
    // z: ... not sure. It looked about right and it needs to be adjusted based on FOV
    $: wOffset = $weapon.position;
    const position = { x: 0, y: 0, z: -170 };
    $: position.x = $wOffset.x - 160;
    $: position.y = $wOffset.y + weaponTop;
</script>

<WeaponSprite
    sprite={$sprite}
    sector={$sector}
    {position}
/>
{#if $flashSprite}
    <WeaponSprite
        flash
        sprite={$flashSprite}
        sector={$sector}
        {position}
    />
{/if}
