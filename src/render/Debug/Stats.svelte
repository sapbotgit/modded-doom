<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { useFrame, useThrelte } from '@threlte/core';
    import Stats from 'three/examples/jsm/libs/stats.module';
    import type { WebGLRenderer } from 'three';

    const { renderer } = useThrelte();
    renderer.info.autoReset = false;

    class RenderInfoPanel {
        max: number;
        panel: Stats.Panel;

        constructor(readonly field: keyof WebGLRenderer['info']['render'], name: string, foreground: string, background: string) {
            this.panel = new Stats.Panel(name, foreground, background)
        }

        updateInfo() {
            const value = renderer.info.render[this.field];
            this.max = Math.max(this.max, value);
            this.panel.update(value, this.max);
        }
    }

    if (import.meta.env.DEV) {
        const stats = new Stats();
        stats.dom.style.left = null;
        stats.dom.style.right = '0px';

        onMount(() => document.body.appendChild(stats.dom));
        onDestroy(() => document.body.removeChild(stats.dom));

        const panels = [
            new RenderInfoPanel('triangles', 'tri', 'white', 'black'),
            new RenderInfoPanel('calls', 'draw', 'white', 'black'),
        ];
        panels.forEach(p => stats.addPanel(p.panel));

        useFrame(stats.begin, {
            order: -100
        });

        useFrame(() => {
            // add stats.end at the very end of the executing frameloophandlers
            stats.end();
            panels.forEach(p => p.updateInfo());
            renderer.info.reset();
        }, {
            order: 100
        });
    }
</script>
