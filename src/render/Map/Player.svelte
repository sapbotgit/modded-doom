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

    const cPass = new ShaderPass(ScreenColorShader);
    $: cPass.uniforms.invunlTime.value = $inventory.items.invincibilityTicks / ticksPerSecond;
    $: cPass.uniforms.radiationTime.value = $inventory.items.radiationSuitTicks / ticksPerSecond;
    $: cPass.uniforms.berserkTime.value = $inventory.items.berserkTicks / ticksPerSecond;
    $: cPass.uniforms.damageCount.value = $damageCount;
    $: cPass.uniforms.bonusCount.value = $bonusCount;
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
