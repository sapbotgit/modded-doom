<script lang="ts">
    import { Mesh, OrthographicCamera, PerspectiveCamera } from "@threlte/core";
    import Thing from "./Thing.svelte";
    import { AdditiveBlending, Color, MeshBasicMaterial, PlaneGeometry } from "three";
    import Weapon from "./Weapon.svelte";
    import { useDoomMap } from "../DoomContext";
    import { HALF_PI, ticksPerSecond } from "../../doom";

    const { map } = useDoomMap();
    const { mode, position: cameraPosition, rotation: cameraRotation } = map.camera;
    const player = map.player;
    const { position: playerPosition, damageCount, bonusCount, inventory } = player;

    const yScale = 4 / 3 / (16 / 10);
    $: camPos = $cameraPosition;

    // post processing would probably be nicer than and overlay (maybe more gpu/less CPU?) but it's too
    // much of a learning curve for me right now. I've got other things to fix/add first
    const overlayMaterial = new MeshBasicMaterial({
        transparent: true,
        color: Color.NAMES.darkgoldenrod,
        opacity: 0.5,
        blending: AdditiveBlending,
    });
    $: updateOverlay(
        Math.max($damageCount, $inventory.items.berserkTicks / ticksPerSecond),
        $bonusCount,
        $inventory.items.radiationSuitTicks,
        $inventory.items.invincibilityTicks
    );

    function updateOverlay(
        redCount: number,
        goldCount: number,
        greenCount: number,
        whiteCount: number
    ) {
        if (whiteCount) {
            overlayMaterial.color.set(Color.NAMES.white);
            overlayMaterial.blending = AdditiveBlending
            overlayMaterial.opacity = .8;
        } else if (redCount) {
            overlayMaterial.color.set(Color.NAMES.maroon);
            overlayMaterial.opacity =
                0.8 * Math.sin((Math.min(20, redCount) / 20) * HALF_PI);
        } else if (goldCount) {
            overlayMaterial.color.set(Color.NAMES.darkgoldenrod);
            overlayMaterial.opacity =
                0.2 * Math.sin((Math.min(5, goldCount) / 5) * HALF_PI);
        } else if (greenCount) {
            overlayMaterial.color.set(Color.NAMES.lime);
            const fadeSpan = 2 * ticksPerSecond;
            const t = (greenCount % fadeSpan) / fadeSpan;
            overlayMaterial.opacity =
                0.3 * (greenCount > 6 * ticksPerSecond ? 1 : Math.sin(t * t * Math.PI));
        } else {
            overlayMaterial.color.set(0);
            overlayMaterial.opacity = 0;
        }
    }
</script>

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

        <Mesh
            renderOrder={2}
            geometry={new PlaneGeometry()}
            material={overlayMaterial}
            position={{ z: -.1 }}
        />
    </PerspectiveCamera>
{/if}
