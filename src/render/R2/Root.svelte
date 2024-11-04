<script lang="ts">
    import { MapObject, MFFlags, type MapRuntime } from "../../doom";
    import { useAppContext, useDoomMap } from "../DoomContext";
    import Stats from "../Debug/Stats.svelte";
    import SkyBox from "../Map/SkyBox.svelte";
    import Player from "../Map/Player.svelte";
    import MapGeometry from "./MapGeometry.svelte";
    import { T, useThrelte } from "@threlte/core";
    import { interactivity } from "@threlte/extras";
    import EditorTagLink from "../Editor/EditorTagLink.svelte";
    import { Vector3, Quaternion, Euler, Camera } from "three";
    import { buildLightMap } from "./GeometryBuilder";
    import { onDestroy } from "svelte";
    import { createShadowsSpriteMaterial, createSpriteGeometry, createSpriteMaterial, SpriteSheet } from "./Sprite";

    export let map: MapRuntime;
    const { renderSectors, camera } = useDoomMap();
    const { rev, trev } = map;
    const { extraLight } = map.player;
    const { tick, partialTick } = map.game.time;
    let tracers: typeof map.tracers;
    $: if ($trev) {
        tracers = map.tracers;
    }

    const { editor, settings } = useAppContext();
    const { playerLight } = settings;
    const interact = interactivity({ enabled: $editor.active });
    $: interact.enabled.set($editor.active);

    // beware of hacking below...
    function hit(ev) {
        ev.stopPropagation();

        const id = ev.object.geometry.attributes.doomInspect.array[ev.instanceId];
        $editor.selected = map.objs.find(e => e.id === id);
    }

    const threlte = useThrelte();
    const maxTextureSize = Math.min(8192, threlte.renderer.capabilities.maxTextureSize);
    const spriteSheet = new SpriteSheet(map.game.wad, maxTextureSize);

    // function imageUrl(tx: DataTexture) {
    //     const canvas = document.createElement('canvas');
    //     canvas.width = tx.image.width;
    //     canvas.height = tx.image.height;
    //     const ctx = canvas.getContext('2d');
    //     const img = ctx.createImageData(canvas.width, canvas.height);
    //     img.data.set(tx.image.data);
    //     ctx.putImageData(img, 0, 0);

    //     // convert to data url
    //     const dataUrl = canvas.toDataURL('image/png');
    //     return dataUrl;
    // }

    // const img = document.createElement('img')
    // img.src = imageUrl(spriteSheet.sheet)
    // img.style.position = 'absolute';
    // img.style.right = '0px';
    // onMount(() => document.body.appendChild(img));
    // onDestroy(() => {
    //     document.body.removeChild(img)
    // });

    // sprite offset test:
    // http://localhost:5173/#wad=doom&skill=4&map=E1M3&player-x=299.19&player-y=-2463.11&player-z=358.96&player-aim=-0.14&player-dir=-1.54

    const { lightMap, lightLevels } = buildLightMap(renderSectors.map(e => e.sector));
    const { material, depthMaterial, distanceMaterial, uniforms } = createSpriteMaterial(spriteSheet, lightMap, lightLevels);
    const shadows = createShadowsSpriteMaterial(spriteSheet, lightMap, lightLevels);
    const shadowsUniform = shadows.uniforms;

    // https://discourse.threejs.org/t/mesh-points-to-the-camera-on-only-2-axis-with-shaders/21555/7
    const threlteCam = threlte.camera;
    const { position, angle } = camera;
    const _q = new Quaternion();
    const _z0 = new Vector3(0, -1, 0);
    const _z1 = new Vector3();
    $: quat = updateCamera($threlteCam, $position, $angle);
    $: $uniforms.camQ.value.copy(quat);
    $: $shadowsUniform.camQ.value.copy(quat);
    function updateCamera(cam: Camera, p: Vector3, a: Euler) {
        cam.getWorldDirection(_z1);
        // _z1.set(0, 0, -1);
        // _z1.applyEuler(a);
        _z1.setZ(0).negate().normalize();
        _q.setFromUnitVectors(_z0, _z1);
        return _q;
    }
    $: $uniforms.doomExtraLight.value = $extraLight / 255;
    $: if ($tick || $partialTick) {
        $uniforms.time.value = map.game.time.elapsed;
        $shadowsUniform.time.value = map.game.time.elapsed;
    }
    $: ((edit) => {
        // map objects have 'health' so only handle those
        $uniforms.dInspect.value = edit.selected && 'health' in edit.selected
            ? edit.selected.id
            // clear selection
            : -1;
    })($editor);

    const geo = createSpriteGeometry(spriteSheet, material, depthMaterial, distanceMaterial);
    const shadowsGeo = createSpriteGeometry(spriteSheet, shadows.material, shadows.depthMaterial, shadows.distanceMaterial);

    onDestroy(() => {
        geo.rmobjs.values().forEach(r => geo.destroy(r.mo));
        shadowsGeo.rmobjs.values().forEach(r => geo.destroy(r.mo));
    })

    $: usePlayerLight = $playerLight !== '#000000';
    $: geo.shadowState(usePlayerLight);
    $: shadowsGeo.shadowState(usePlayerLight);

    $: (n => {
        let added = new Set<MapObject>();
        let updated = new Set<MapObject>();
        let removed = new Set<MapObject>();

        // it would be nice if this was moved into MapRuntime and we just get notification on add/remove/update
        for (const mo of map.objs) {
            const set = (geo.rmobjs.has(mo.id) || shadowsGeo.rmobjs.has(mo.id)) ? updated : added;
            if (!(mo.info.flags & MFFlags.MF_NOSECTOR)) {
                set.add(mo);
            }
        }
        for (const r of geo.rmobjs.values()) {
            if (!added.has(r.mo) && !updated.has(r.mo)) {
                removed.add(r.mo);
            }
        }
        for (const r of shadowsGeo.rmobjs.values()) {
            if (!added.has(r.mo) && !updated.has(r.mo)) {
                removed.add(r.mo);
            }
        }

        for (const mo of removed) {
            geo.destroy(mo);
        }
        for (const mo of added) {
            if (mo.info.flags & MFFlags.MF_SHADOW) {
                shadowsGeo.add(mo);
            } else {
               geo.add(mo);
            }
        }
    })($rev);
</script>

<Stats />

<SkyBox />

<MapGeometry />

<T is={geo.root} on:click={hit} renderOrder={1} />
<T is={shadowsGeo.root} on:click={hit} renderOrder={1} />

<Player />

<EditorTagLink {map} />
