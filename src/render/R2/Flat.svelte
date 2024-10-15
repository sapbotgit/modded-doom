<script lang="ts">
    import { BufferGeometry } from "three";
    import { type RenderSector } from "../RenderData";
    import { getContext } from "svelte";
    import { type GeometryBuilder } from "./MapGeometry.svelte";

    export let renderSector: RenderSector;
    export let textureName: string;
    export let vertical: number;
    export let ceiling = false;

    const geometry = renderSector.geometry.clone();
    // CAUTION: geometry.clone() re-uses userData so we do a copy but it's not a deep copy
    geometry.userData = { ...geometry.userData };
    geometry.userData['sky'] = textureName === 'F_SKY1';

    // https://github.com/mrdoob/three.js/issues/17361
    function flipWindingOrder(geometry: BufferGeometry) {
        const index = geometry.index.array;
        for (let i = 0, end = index.length / 3; i < end; i++) {
        const x = index[i * 3];
        index[i * 3] = index[i * 3 + 2];
        index[i * 3 + 2] = x;
        }
        geometry.index.needsUpdate = true;


        for (let i = 0; i < geometry.attributes.normal.array.length; i++) {
            geometry.attributes.normal.array[i] *= -1;
        }
        geometry.attributes.normal.needsUpdate = true;
    }

    if (ceiling) {
        // flip over triangles for ceiling
        flipWindingOrder(geometry);
    }

    const mapGeo = getContext<GeometryBuilder>('doom-map-geo');
    const flatGeo = mapGeo.addFlat(geometry, renderSector.sector.num);
    $: mapGeo.applyFlatTexture(flatGeo, textureName);
    $: mapGeo.moveFlat(flatGeo, vertical);
</script>
