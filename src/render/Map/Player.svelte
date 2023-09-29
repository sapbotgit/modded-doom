<script lang="ts">
    import { Mesh, OrthographicCamera, Pass, PerspectiveCamera } from "@threlte/core";
    import Thing from "./Thing.svelte";
    import { MeshBasicMaterial, PlaneGeometry } from "three";
    import Weapon from "./Weapon.svelte";
    import { useDoomMap } from "../DoomContext";
    import { ticksPerSecond } from "../../doom";
    import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader';
    import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
    import { ScreenColorShader } from "../Shaders/ScreenColorShader";

    const { map } = useDoomMap();
    const { mode, position: cameraPosition, rotation: cameraRotation } = map.camera;
    const player = map.player;
    const { position: playerPosition, damageCount, bonusCount, inventory } = player;

    const yScale = 4 / 3 / (16 / 10);
    $: camPos = $cameraPosition;

    $: updateOverlay(
        $inventory.items.nightVisionTicks / ticksPerSecond,
        $inventory.items.invincibilityTicks / ticksPerSecond,
        $inventory.items.radiationSuitTicks / ticksPerSecond,
        $inventory.items.berserkTicks / ticksPerSecond,
        $damageCount,
        $bonusCount,
    );

    const cPass = new ShaderPass(ScreenColorShader);

    function updateOverlay(
        nightVisionTime: number,
        invunlTime: number,
        radiationTime: number,
        berserkTime: number,
        damageCount: number,
        bonusCount: number,
    ) {
        const isFullBright = invunlTime > 1.0 || nightVisionTime > 5 || nightVisionTime % 2 > 1;
        player.extraLight.set(isFullBright ? 255 : 0);
        cPass.uniforms.invunlTime.value = invunlTime;
        cPass.uniforms.radiationTime.value = radiationTime;
        cPass.uniforms.berserkTime.value = berserkTime;
        cPass.uniforms.damageCount.value = damageCount;
        cPass.uniforms.bonusCount.value = bonusCount;
    }
</script>

<Pass pass={new ShaderPass(GammaCorrectionShader)} />
<Pass pass={cPass} />/

{#if $mode !== "1p"}
    <Thing thing={player} />

    <Mesh
        geometry={new PlaneGeometry(
            player.info.radius * 2,
            player.info.radius * 2
        )}
        position={{
            x: $playerPosition.x,
            y: $playerPosition.y,
            z: player.sector.val.zFloor.val + 1,
        }}
        material={new MeshBasicMaterial({ color: "green" })}
    />
{/if}

{#if $mode === "ortho"}
    <OrthographicCamera
        rotation={$cameraRotation}
        position={camPos}
        far={100000}
    />
{:else}
    <PerspectiveCamera
        rotation={$cameraRotation}
        position={camPos}
        far={100000}
        fov={72}
        scale={{ y: yScale }}
    >
        {#if $mode === "1p"}
            <Weapon {player} />
        {/if}
    </PerspectiveCamera>
{/if}
