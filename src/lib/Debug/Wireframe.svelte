<script lang="ts">
    import { Object3DInstance, useParent } from "@threlte/core";
    import { LineSegments, Mesh, WireframeGeometry } from "three";
    import { useDoom } from "../DoomContext";

    const { wireframe } = useDoom().settings;

    const parent = useParent();
    const geom = new WireframeGeometry(($parent as Mesh).geometry);

    const lines = new LineSegments(geom);
    $: if ('depthTest' in lines.material) {
        lines.material.depthTest = $wireframe === 'visible';
    }
</script>

{#if $wireframe !== 'none'}
    <Object3DInstance
        renderOrder={1000}
        object={lines}
    />
{/if}