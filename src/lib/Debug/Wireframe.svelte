<script lang="ts">
    import { Object3DInstance, useParent } from "@threlte/core";
    import { LineSegments, Mesh, WireframeGeometry } from "three";

    const showGeometry = false;

    const parent = useParent();
    const wireframe = new WireframeGeometry(($parent as Mesh).geometry);

    const lines = new LineSegments(wireframe);
    if ('depthTest' in lines.material) {
        lines.material.depthTest = false;
    }
</script>

{#if showGeometry}
    <Object3DInstance
        renderOrder={1000}
        object={lines}
    />
{/if}