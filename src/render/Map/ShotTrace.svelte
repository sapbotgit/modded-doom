<script lang="ts">
    import { T } from "@threlte/core";
    import { MapRuntime, ticksPerSecond } from "../../doom";
    import { BufferGeometry, LineBasicMaterial } from "three";
    import { useAppContext } from "../DoomContext";

    export let trace: MapRuntime['tracers'][0];
    const { shotTraceSeconds } = useAppContext().settings;
    const ticks = trace.ticks;

    const geometry = new BufferGeometry().setFromPoints([ trace.start, trace.end ]);
    const material = new LineBasicMaterial({ color: 'white', transparent: true });
    $: material.opacity = $ticks / ($shotTraceSeconds * ticksPerSecond);
</script>

<T.Line
    {geometry}
    {material}
/>
