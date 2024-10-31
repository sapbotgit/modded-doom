<script lang="ts">
    import { MapObject, type MapRuntime } from "../../doom";
    import { useAppContext, useDoomMap } from "../DoomContext";
    import Stats from "../Debug/Stats.svelte";
    import SkyBox from "../Map/SkyBox.svelte";
    import Player from "../Map/Player.svelte";
    import MapGeometry from "./MapGeometry.svelte";
    import { T } from "@threlte/core";
    import { interactivity } from "@threlte/extras";
    import SectorThings from "./SectorThings.svelte";
    import EditorTagLink from "../Editor/EditorTagLink.svelte";
    import { BoxGeometry, InstancedMesh, MeshStandardMaterial, Matrix4, Vector3, Quaternion, Color } from "three";
    import { int16BufferFrom } from "./GeometryBuilder";

    export let map: MapRuntime;
    const { renderSectors } = useDoomMap();
    const { rev, trev } = map;
    let tracers: typeof map.tracers;
    $: if ($trev) {
        tracers = map.tracers;
    }

    const { editor } = useAppContext();
    const interact = interactivity({ enabled: $editor.active });
    $: interact.enabled.set($editor.active);

    // Are chunks actually beneficial? It's probably better than resizing/re-initializing a large array
    // but maybe worth experimenting with sometime.
    const chunkSize = 5_000;
    const material = new MeshStandardMaterial();
    let thingsMeshes: InstancedMesh[] = [];
    const createChunk = () => {
        const mesh = new InstancedMesh(
            new BoxGeometry(),
            material,
            chunkSize,
        );
        mesh.geometry.setAttribute('doomLight', int16BufferFrom([0], 0));
        mesh.count = 0;
        // mesh.frustumCulled = false;
        // TODO: use setting.playerLight like MapGeometry?
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    interface RenderInfo {
        idx: number;
        mo: MapObject;
    }
    const rmobjs = new Map<number, RenderInfo>();

    const mat = new Matrix4();
    const p = new Vector3( 1, 1, 1 );
    const q = new Quaternion();
    const s = new Vector3( 1, 1, 1 );
    const up = new Vector3(0, 0, 1);
    function add(mo: MapObject, idx: number) {
        let m = Math.floor(idx / chunkSize);
        let n = idx % chunkSize;
        if (n === 0 && idx > 0) {
            // this chunk is full
            thingsMeshes[m - 1].count = chunkSize;
            console.log('filled',m-1)
        }
        // create new chunk if needed
        if (thingsMeshes.length === m) {
            console.log('new chunk',m)
            thingsMeshes.push(createChunk());
            thingsMeshes = thingsMeshes;
        }

        q.setFromAxisAngle(up, mo.direction.val);
        s.set(mo.info.radius, mo.info.radius, mo.info.height);
        p.copy(mo.position.val);
        p.z += mo.info.height * .5;
        thingsMeshes[m].geometry.attributes.doomLight.array[n] = mo.sector.val.num;
        thingsMeshes[m].setMatrixAt(n, mat.compose(p, q, s));
        thingsMeshes[m].setColorAt(n, new Color(Math.floor(Math.random() * 0xffffff)))
        thingsMeshes[m].instanceColor.needsUpdate = true;
        thingsMeshes[m].instanceMatrix.needsUpdate = true;
        rmobjs.set(mo.id, { mo, idx });
    }
    function destroy(mo: MapObject) {
        const info = rmobjs.get(mo.id);
        rmobjs.delete(mo.id);

        let m = Math.floor(info.idx / chunkSize);
        let n = info.idx % chunkSize;
        // We can't actually remove an instanced geometry but we can hide it until something else uses the free slot.
        // We hide by moving it far away or scaling it very tiny (making it effectively invisible)
        s.set(0, 0, 0);
        thingsMeshes[m].setMatrixAt(n, mat.compose(p, q, s));
        thingsMeshes[m].instanceMatrix.needsUpdate = true;
        return info.idx;
    }

    const freeSlots: number[] = [];
    $: (n => {
        let added = new Set<MapObject>();
        let updated = new Set<MapObject>();
        let removed = new Set<MapObject>();

        // it would be nice if this was moved into MapRuntime and we just get notification on add/remove/update
        for (const mo of map.objs) {
            const set = rmobjs.has(mo.id) ? updated : added;
            set.add(mo);
        }
        for (const mo of rmobjs) {
            if (!added.has(mo[1].mo) && !updated.has(mo[1].mo)) {
                removed.add(mo[1].mo);
            }
        }

        let idx = 0;
        for (const mo of updated) {
            // TBD?
            idx += 1;
        }
        for (const mo of removed) {
            const id = destroy(mo);
            freeSlots.push(id);
        }
        for (const mo of added) {
            let slot = freeSlots.pop() ?? idx;
            if (slot === idx) {
                idx += 1;
            }
            add(mo, slot);
        }
        // set count on last chunk (assume everything else stays at chunkSize)
        // NB: count will not decrease because removed items may not be at the end of the list
        thingsMeshes[Math.floor(idx / chunkSize)].count = Math.max(
            idx % chunkSize,
            thingsMeshes[Math.floor(idx / chunkSize)].count);
        material.needsUpdate = true;

        console.log(idx,
            [map.objs.length, rmobjs.size],
            [added.size, updated.size, removed.size],
            thingsMeshes[Math.floor(idx / chunkSize)].count);
    })($rev);
</script>

<Stats />

<SkyBox />

<MapGeometry />

{#each thingsMeshes as mesh}
    <T is={mesh} />
{/each}

<!-- {#each renderSectors as renderSector}
    <SectorThings {renderSector} />
{/each} -->

<Player />

<EditorTagLink {map} />
