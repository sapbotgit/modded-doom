<script lang="ts">
    import { PerfMonitor } from '@threlte/extras';
    import { useAppContext } from '../DoomContext';
    import { ThreePerf } from 'three-perf';
    import { useTask, useThrelte } from '@threlte/core';
    import { onDestroy } from 'svelte';

    const { renderer, renderStage } = useThrelte();
    const { showStats } = useAppContext().settings;

    // we can't use PerfMonitor from @threlte/extras out of the box because of how we throttle framerates. hmm
    const { start, stop } = useTask(() => {
        perf.end();
        perf.begin();
    }, {
        stage: renderStage
    });

    let perf: ThreePerf;
    $: if ($showStats) {
        perf = new ThreePerf({
            domElement: document.body,
            renderer: renderer,
            anchorY: 'top',
            anchorX: 'right',
        });
        start();
    } else {
        perf?.dispose();
        stop();
    }

    onDestroy(() => {
        perf?.dispose();
    });
</script>
