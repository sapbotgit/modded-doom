<script lang="ts">
    import { T, useThrelte } from "@threlte/core";
    import { useAppContext, useDoomMap } from "../../DoomContext";
    import { SpriteSheet } from "./SpriteAtlas";
    import { buildLightMap } from "../GeometryBuilder";
    import { createSpriteMaterialTransparent, createSpriteMaterial } from "./Materials";
    import { Camera, Euler, Quaternion, Vector3 } from "three";
    import { createSpriteGeometry } from "./Geometry";
    import { onDestroy } from "svelte";
    import { MapRuntime, MFFlags, tickTime, type MapObject } from "../../../doom";

    export let map: MapRuntime;

    const { renderSectors, camera } = useDoomMap();
    const { extraLight } = map.player;
    const { tick, partialTick } = map.game.time;
    // TODO: draw tracers?
    // let tracers: typeof map.tracers;
    // $: if ($trev) {
    //     tracers = map.tracers;
    // }

    const { editor, settings } = useAppContext();
    const { playerLight, interpolateMovement } = settings;

    function hit(ev) {
        ev.stopPropagation();

        const id = ev.object.geometry.attributes.doomInspect.array[ev.instanceId];
        $editor.selected = map.objs.find(e => e.id === id);
    }

    const threlte = useThrelte();
    const maxTextureSize = Math.min(8192, threlte.renderer.capabilities.maxTextureSize);
    const spriteSheet = new SpriteSheet(map.game.wad, maxTextureSize);

    // sprite offset test:
    // http://localhost:5173/#wad=doom&skill=4&map=E1M3&player-x=321.09&player-y=-2486.21&player-z=343.17&player-aim=-0.00&player-dir=-1.57

    const { lightMap, lightLevels } = buildLightMap(renderSectors.map(e => e.sector));
    const { material, depthMaterial, distanceMaterial, uniforms } = createSpriteMaterial(spriteSheet, lightMap, lightLevels);
    const tranMaterial = createSpriteMaterialTransparent(spriteSheet, lightMap, lightLevels);
    const tranUniforms = tranMaterial.uniforms;

    const threlteCam = threlte.camera;
    const { position, angle } = camera;
    const updateCameraUniforms = (() => {
        // https://discourse.threejs.org/t/mesh-points-to-the-camera-on-only-2-axis-with-shaders/21555/7
        const q = new Quaternion();
        const z0 = new Vector3(0, -1, 0);
        const z1 = new Vector3();
        return (cam: Camera, p: Vector3, a: Euler) => {
            cam.getWorldDirection(z1);
            // if we want to remove a dependency on $threlteCamera, we could use:
            // z1.set(0, 0, -1);
            // z1.applyEuler(a);
            z1.setZ(0).negate().normalize();
            q.setFromUnitVectors(z0, z1);

            $uniforms.camQ.value.copy(q);
            $tranUniforms.camQ.value.copy(q);

            $uniforms.camP.value.copy(p);
            $tranUniforms.camP.value.copy(p);
        }
    })();

    function updateTimeUniforms(time: number) {
        const t2 = time * tickTime
        $uniforms.time.value = t2;
        $uniforms.tics.value = $interpolateMovement ? time : 0;
        $tranUniforms.time.value = t2;
        $tranUniforms.tics.value =  $interpolateMovement ? time : 0;
    }

    $: updateCameraUniforms($threlteCam, $position, $angle);
    $: $uniforms.doomExtraLight.value = $extraLight / 255;
    $: updateTimeUniforms($tick + $partialTick);
    $: ((edit) => {
        // map objects have 'health' so only handle those
        $uniforms.dInspect.value = edit.selected && 'health' in edit.selected
            ? edit.selected.id
            // clear selection
            : -1;
    })($editor);

    const geo = createSpriteGeometry(spriteSheet, map, material, depthMaterial, distanceMaterial);
    const tranGeo = createSpriteGeometry(spriteSheet, map, tranMaterial.material, tranMaterial.depthMaterial, tranMaterial.distanceMaterial);
    onDestroy(() => {
        geo.rmobjs.values().forEach(r => geo.destroy(r.mo));
        tranGeo.rmobjs.values().forEach(r => geo.destroy(r.mo));
    })

    $: usePlayerLight = $playerLight !== '#000000';
    $: geo.shadowState(usePlayerLight);
    $: tranGeo.shadowState(usePlayerLight);

    const addMobj = (mo: MapObject) => {
        if (mo.info.flags & MFFlags.MF_SHADOW) {
            tranGeo.add(mo);
        } else {
            geo.add(mo);
        }
    }
    const removeMobjs = (mo: MapObject) => {
        geo.destroy(mo);
        tranGeo.destroy(mo);
    }
    map.objs.forEach(addMobj);
    map.events.on('mobj-added', addMobj);
    map.events.on('mobj-removed', removeMobjs);
    onDestroy(() => {
        map.events.off('mobj-added', addMobj);
        map.events.off('mobj-removed', removeMobjs);
    });
</script>

<T is={geo.root} on:click={hit} renderOrder={1} />
<T is={tranGeo.root} on:click={hit} renderOrder={1} />
