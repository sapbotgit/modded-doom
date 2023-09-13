<script lang="ts" context="module">
    // cache ImageData so we don't always create a new image context when we load a new image
    const cache = new Map<string, ImageData>();
</script>
<script lang="ts">
    import { afterUpdate } from "svelte";
    import { useDoom } from "../DoomContext";

    export let name: string;
    export let type: 'wall' | 'flat' | 'any' = 'any';

    const { wad } = useDoom();
    $: data = type === 'any' ? wad.graphic(name) :
        type === 'wall' ? wad.wallTextureData(name) :
        wad.flatTextureData(name);

    let canvas: HTMLCanvasElement;
    afterUpdate(() => {
        const ctx = canvas.getContext('2d');
        const key = name + type;
        let imageData = cache.get(key)
        if (!imageData) {
            imageData = ctx.createImageData(data.width, data.height);
            data.toBuffer(imageData.data);
            cache.set(key, imageData);
        }
        ctx.putImageData(imageData, 0, 0);
    });
</script>

<canvas
    bind:this={canvas}
    width={data.width}
    height={data.height}
/>