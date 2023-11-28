<script lang="ts">
    import { type Size, T } from "@threlte/core";
    import { weaponTop, type PlayerMapObject } from "../../doom";
    import WeaponSprite from "../Components/WeaponSprite.svelte";
    import { useDoom } from "../DoomContext";

    export let player: PlayerMapObject;
    export let screenSize: Size;
    export let yScale: number;

    const { sector, weapon } = player;

    $: sprite = $weapon.sprite;
    $: flashSprite = $weapon.flashSprite;

    const position = { x: 0, y: 0, z: -2 };
    $: wOffset = $weapon.position;
    $: position.x = $wOffset.x - 160;
    $: position.y = $wOffset.y + weaponTop;

    const cameraMode = useDoom().game.settings.cameraMode;
    $: scale = $cameraMode === '1p' ? 2.5 : 1;
    const screenPosition = { x: 0, y: 0 };
    $: if ($cameraMode === '1p') {
        screenPosition.x = 0;
        screenPosition.y = 0;
    } else {
        screenPosition.x = position.x + 320 - screenSize.width * .5;
        screenPosition.y = position.y - screenSize.height * .5 + weaponTop;
    }
</script>

<T.Group
    scale.x={scale}
    scale.y={scale / yScale}
    position.x={screenPosition.x}
    position.y={screenPosition.y}
>
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
</T.Group>