<script lang="ts">
    import { type MapRuntime } from "../../doom";
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
    import { onMount } from "svelte";
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
    let thingsMeshes: InstancedMesh[] = [];
    const createChunk = () => {
        const mesh = new InstancedMesh(
            new BoxGeometry(),
            new MeshStandardMaterial(),
            chunkSize,
        );
        mesh.geometry.setAttribute('doomLight', int16BufferFrom([0], 0));
        // mesh.frustumCulled = false;
        mesh.count = 0;
        return mesh;
    }

    $: (n => {
        const mat = new Matrix4();
        const p = new Vector3( 1, 1, 1 );
        const q = new Quaternion();
        const s = new Vector3( 1, 1, 1 );
        const up = new Vector3(0, 0, 1);

        let idx = 0;
        for (const mo of map.objs) {
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
            thingsMeshes[m].setColorAt(n, new Color('white'))
            idx += 1;
        }
        console.log('things?',idx)
        thingsMeshes[Math.floor(idx / chunkSize)].count = idx % chunkSize;
    })($rev);
</script>

<Stats />

<SkyBox />

<MapGeometry />

{#each thingsMeshes as mesh}
    <T is={mesh} />
{/each}

<!-- <InstancedMesh
    limit={30_000}
>
    <T.BoxGeometry />
    <T.MeshStandardMaterial />

    {#each renderSectors as renderSector}
        <SectorThings {renderSector} />
    {/each}
</InstancedMesh> -->

<Player />

<EditorTagLink {map} />
