<script lang="ts">
    import { Object3DInstance, useParent } from "@threlte/core";
    import { LineSegments, WireframeGeometry } from "three";
    import { useDoom } from "../DoomContext";

    const { wireframe } = useDoom().settings;

    const parent = useParent();
    function obj(p: any, wireframeMode: string) {
        const geom = new WireframeGeometry(p.geometry);
        const lines = new LineSegments(geom);
        if ('depthTest' in lines.material) {
            lines.material.depthTest = (wireframeMode === 'visible');
        }
        return lines;
    }
</script>

{#if $wireframe !== 'none'}
    <Object3DInstance
        renderOrder={1000}
        object={obj($parent, $wireframe)}
    />
{/if}