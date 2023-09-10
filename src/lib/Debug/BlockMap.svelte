<script lang="ts">
    import { BufferGeometry, GridHelper, MeshBasicMaterial, PlaneGeometry, Vector3 } from "three";
    import { HALF_PI, type MapRuntime } from "../../doom";
    import { Line, Mesh, Object3DInstance } from "@threlte/core";

    export let map: MapRuntime;

    const showBlockmap = false;

    const { position: playerPosition } = map.player;

    const bbox = map.data.blockmap.bounds;
    const width = bbox.right - bbox.left;
    const height = bbox.top - bbox.bottom;
    const size = Math.max(width, height);
    const gh = new GridHelper(size, Math.ceil(size / 128));

    const v1 = new Vector3();
    const v2 = new Vector3();
    const lineMat = new MeshBasicMaterial({ color: 'magenta' });
    const traceMat = new MeshBasicMaterial({ color: 'red', transparent: true, opacity: .3 });
    const { lastTrace, lastTrace2 } = map.data.blockmap;
</script>

{#if showBlockmap}
    <Object3DInstance
        object={gh}
        rotation={{ x: HALF_PI }}
        position={{
            x: bbox.left + size * .5,
            y: bbox.bottom + size * .5,
            z: $playerPosition.z + 1 }}
    />

    <Line
        geometry={new BufferGeometry().setFromPoints([
            v1.copy($lastTrace2.start).setZ($playerPosition.z + 2),
            v2.copy($lastTrace2.end).setZ($playerPosition.z + 2),
        ])}
        material={lineMat} />
    <Line
        geometry={new BufferGeometry().setFromPoints([
            v1.copy($lastTrace2.start),
            v2.copy($lastTrace2.end),
        ])}
        material={lineMat} />

    {#each $lastTrace as pos}
        <Mesh
            position={{
                x: bbox.left + pos.col * 128 + 64,
                y: bbox.bottom + pos.row * 128 + 64,
                z: $playerPosition.z + 1,
            }}
            geometry={new PlaneGeometry(128, 128)}
            material={traceMat}
        />
    {/each}
{/if}
