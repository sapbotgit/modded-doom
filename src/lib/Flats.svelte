<script lang="ts">
    import { Color, Shape, ShapeGeometry } from "three";
    import type { RenderSector, Vertex } from "../doomwad";
    import Flat from "./Flat.svelte";
    import { HALF_PI } from "./Math";

    export let index: number;
    export let renderSector: RenderSector;

    function namedColor(n: number) {
        return Object.values(Color.NAMES)[n % Object.keys(Color.NAMES).length];
    }
    $: color = namedColor(index);
    $: geometry = createShape(renderSector.vertexes);
    const { zFloor, floorFlat, zCeil, ceilFlat } = renderSector.sector;

    function createShape(verts: Vertex[]) {
        const shape = new Shape();
        shape.autoClose = true;
        shape.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i++) {
            shape.lineTo(verts[i].x, verts[i].y);
        }
        const geometry = new ShapeGeometry(shape, 1);
        geometry.rotateX(-HALF_PI);
        return geometry;
    }
</script>

<Flat
    {geometry} {color} {renderSector}
    vertical={$zFloor}
    textureName={$floorFlat}
/>

<!--
    TODO: for a level editor, it would actually be useful to still draw this so
    we can click on it and edit. Something to think about (same for Wall.svelte)
-->
{#if $ceilFlat !== 'F_SKY1'}
    <Flat
        {geometry} {color} {renderSector}
        ceiling
        vertical={$zCeil}
        textureName={$ceilFlat}
    />
{/if}
