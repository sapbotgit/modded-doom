<script lang="ts">
    import { Mesh, Pass } from "@threlte/core";
    import Thing from "./Thing.svelte";
    import { CircleGeometry, MeshStandardMaterial } from "three";
    import { useDoomMap } from "../DoomContext";
    import { ticksPerSecond } from "../../doom";
    import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader';
    import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
    import { ScreenColorShader } from "../Shaders/ScreenColorShader";
    import OrthoCam from "./Camera/Orthographic.svelte";
    import FirstPersonCam from "./Camera/FirstPerson.svelte";

    const { map, renderSectors } = useDoomMap();
    const { cameraMode } = map.game.settings;
    const player = map.player;
    const { position: playerPosition, damageCount, bonusCount, inventory, sector } = player;
    $: renderSector = $sector && renderSectors.find(e => e.sector === $sector)

    const yScale = 4 / 3 / (16 / 10);

    const cPass = new ShaderPass(ScreenColorShader);
    $: cPass.uniforms.invunlTime.value = $inventory.items.invincibilityTicks / ticksPerSecond;
    $: cPass.uniforms.radiationTime.value = $inventory.items.radiationSuitTicks / ticksPerSecond;
    $: cPass.uniforms.berserkTime.value = $inventory.items.berserkTicks / ticksPerSecond;
    $: cPass.uniforms.damageCount.value = $damageCount;
    $: cPass.uniforms.bonusCount.value = $bonusCount;
</script>

<Pass pass={new ShaderPass(GammaCorrectionShader)} />
<Pass pass={cPass} />

{#if $cameraMode !== "1p"}
    <Thing {renderSector} thing={player} />

    <Mesh
        geometry={new CircleGeometry(player.info.radius)}
        renderOrder={2}
        position={{
            x: $playerPosition.x,
            y: $playerPosition.y,
            z: player.sector.val.zFloor.val + 1,
        }}
        material={new MeshStandardMaterial({ color: "black", opacity: 0.6, transparent: true })}
    />
{/if}

{#if $cameraMode === "ortho"}
    <OrthoCam {yScale} />
{:else}
    <FirstPersonCam {yScale} />
{/if}
