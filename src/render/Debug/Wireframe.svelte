<script lang="ts">
    import { T } from "@threlte/core";
    import { Edges } from "@threlte/extras";
    import { Color } from "three";
    import { useAppContext } from "../DoomContext";

    const { wireframe } = useAppContext().settings;
</script>

{#if $wireframe !== 'none'}
    <Edges thresholdAngle={0} renderOrder={1000}>
        <!-- color doesn't work here... I wonder why? -->
        <T.LineBasicMaterial
            color={Color.NAMES.red}
            depthTest={$wireframe === 'visible'}
        />
    </Edges>
{/if}