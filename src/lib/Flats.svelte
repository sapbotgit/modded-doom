<script lang="ts">
    import { Color, Shape, ShapeGeometry } from "three";
    import type { RenderSector, Store, Vertex } from "../doom";
    import Flat from "./Flat.svelte";

    export let index: number;
    export let renderSector: RenderSector;

    function namedColor(n: number) {
        return Object.values(Color.NAMES)[n % Object.keys(Color.NAMES).length];
    }
    $: color = namedColor(index);
    $: geometry = createShape(renderSector.vertexes);
    let floorFlat: Store<string>, ceilFlat: Store<string>,
        zFloor: Store<number>, zCeil: Store<number>;
    const { rev } = renderSector.sector;
    $: if ($rev) {
        zFloor = renderSector.sector.zFloor;
        zCeil = renderSector.sector.zCeil;
        floorFlat = renderSector.sector.floorFlat;
        ceilFlat = renderSector.sector.ceilFlat;
    }

    function createShape(verts: Vertex[]) {
        const shape = new Shape();
        shape.autoClose = true;
        shape.arcLengthDivisions = 1;
        shape.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i++) {
            shape.lineTo(verts[i].x, verts[i].y);
        }
        return new ShapeGeometry(shape, 1);
    }
</script>

<Flat
    {geometry} {color} {renderSector}
    vertical={$zFloor}
    textureName={$floorFlat}
/>

<Flat
    ceiling
    {geometry} {color} {renderSector}
    vertical={$zCeil}
    textureName={$ceilFlat}
/>
