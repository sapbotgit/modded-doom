<script lang="ts">
    import { T, useThrelte } from "@threlte/core";
    import { useAppContext, useDoomMap } from "../../DoomContext";
    import type { SpriteSheet } from "./SpriteAtlas";
    import { createSpriteMaterialTransparent, createSpriteMaterial } from "./Materials";
    import { Camera, Euler, Quaternion, Vector3 } from "three";
    import { createSpriteGeometry } from "./Geometry";
    import { onDestroy } from "svelte";
    import { MapRuntime, MFFlags, PlayerMapObject, tickTime, type MapObject, type Sprite } from "../../../doom";
    import type { MapLighting } from "../MapLighting";

    export let map: MapRuntime;
    export let spriteSheet: SpriteSheet;
    export let lighting: MapLighting;

    const { camera } = useDoomMap();
    const { extraLight } = map.player;
    const { tick, partialTick } = map.game.time;
    // TODO: draw tracers?
    // let tracers: typeof map.tracers;
    // $: if ($trev) {
    //     tracers = map.tracers;
    // }

    const { editor, settings } = useAppContext();
    const { playerLight, interpolateMovement, cameraMode } = settings;

    function hit(ev) {
        if (!ev.instanceId) {
            return;
        }
        ev.stopPropagation();

        const id = ev.object.geometry.attributes.doomInspect.array[ev.instanceId];
        $editor.selected = map.objs.find(e => e.id === id);
    }

    let material = createSpriteMaterial(spriteSheet, lighting, { cameraMode: $cameraMode });
    let uniforms = material.uniforms;
    let tranMaterial = createSpriteMaterialTransparent(spriteSheet, lighting, { cameraMode: $cameraMode });
    let tranUniforms = tranMaterial.uniforms;

    const threlteCam = useThrelte().camera;
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
    $: updateCameraUniforms($threlteCam, $position, $angle);

    function updateTimeUniforms(time: number) {
        const t2 = time * tickTime
        $uniforms.time.value = t2;
        $uniforms.tics.value = $interpolateMovement ? time : 0;
        $tranUniforms.time.value = t2;
        $tranUniforms.tics.value =  $interpolateMovement ? time : 0;
    }
    $: updateTimeUniforms($tick + $partialTick);

    function updateInspectorUniforms(edit) {
        // map objects have 'health' so only handle those
        $uniforms.dInspect.value = edit.selected && 'health' in edit.selected
            ? edit.selected.id
            // clear selection
            : -1;
        $tranUniforms.dInspect.value = $uniforms.dInspect.value;
    }
    $: updateInspectorUniforms($editor);

    function updateExtraLightUniforms(extraLight: number) {
        $uniforms.doomExtraLight.value = extraLight;
        $tranUniforms.doomExtraLight.value = extraLight;
    }
    $: updateExtraLightUniforms($extraLight / 255);

    const geo = createSpriteGeometry(spriteSheet, material);
    onDestroy(geo.dispose);
    const tranGeo = createSpriteGeometry(spriteSheet, tranMaterial);
    onDestroy(tranGeo.dispose);
    $: if ($cameraMode) {
        material = createSpriteMaterial(spriteSheet, lighting, { cameraMode: $cameraMode });
        uniforms = material.uniforms;
        tranMaterial = createSpriteMaterialTransparent(spriteSheet, lighting, { cameraMode: $cameraMode });
        tranUniforms = tranMaterial.uniforms;

        geo.resetGeometry($cameraMode, material);
        tranGeo.resetGeometry($cameraMode, tranMaterial);
        // set camera uniforms so we project sprites properly on the first frame
        updateCameraUniforms($threlteCam, $position, $angle);
    }

    $: usePlayerLight = $playerLight !== '#000000';
    $: geo.shadowState(usePlayerLight);
    $: tranGeo.shadowState(usePlayerLight);

    const addMobj = (mo: MapObject) => {
        // TODO: we need a better solution for player than this...
        if (mo.info.flags & MFFlags.MF_NOSECTOR || mo instanceof PlayerMapObject) {
            return;
        }
        const geom = (mo.info.flags & MFFlags.MF_SHADOW) ? tranGeo : geo;
        geom.add(mo);
    }
    const removeMobjs = (mo: MapObject) => {
        geo.remove(mo);
        tranGeo.remove(mo);
    }
    const updateMobjSprite = (mo: MapObject, sprite: Sprite) => {
        const info = geo.get(mo) ?? tranGeo.get(mo);
        info?.updateSprite(sprite);
    }

    map.objs.forEach(addMobj);
    map.events.on('mobj-added', addMobj);
    map.events.on('mobj-removed', removeMobjs);
    map.events.on('mobj-updated-sprite', updateMobjSprite);
    onDestroy(() => {
        map.events.off('mobj-added', addMobj);
        map.events.off('mobj-removed', removeMobjs);
        map.events.off('mobj-updated-sprite', updateMobjSprite);
    });
</script>

<T is={geo.root} on:click={hit} renderOrder={1} />
<T is={tranGeo.root} on:click={hit} renderOrder={1} />
