<script lang="ts">
    import { afterUpdate } from "svelte";

    export let data: { width: number, height: number, buffer?: Uint8ClampedArray, data?: Uint8ClampedArray };

    let canvas: HTMLCanvasElement;
    // TODO: this feels is inefficient... draw a new canvas whenever the picture changes?
    // Can't we cache these somehow?
    afterUpdate(() => {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(data.width, data.height);
        const px = data.buffer ?? data.data;
        for (let i = 0; i < data.width * data.height; i++) {
            imageData.data[i * 4 + 0] = px[i * 4 + 0];
            imageData.data[i * 4 + 1] = px[i * 4 + 1];
            imageData.data[i * 4 + 2] = px[i * 4 + 2];
            imageData.data[i * 4 + 3] = px[i * 4 + 3];
        }
        ctx.putImageData(imageData, 0, 0);
    });
</script>

<canvas
    bind:this={canvas}
    width={data.width}
    height={data.height}
/>
