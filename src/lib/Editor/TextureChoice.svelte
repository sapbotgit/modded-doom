<script lang="ts">
    import { onMount } from "svelte";
    import { useDoom } from "../useDoom";

    export let name: string;
    export let type: 'wall' | 'flat';

    const { textures } = useDoom();
    const data = textures.get(name, type).image;

    let canvas: HTMLCanvasElement;
    onMount(() => {
        let ctx = canvas.getContext('2d');
        let imageData = ctx.createImageData(data.width, data.height);
        for (let i = 0; i < data.width * data.height; i++) {
            imageData.data[i * 4 + 0] = data.data[i * 4 + 0];
            imageData.data[i * 4 + 1] = data.data[i * 4 + 1];
            imageData.data[i * 4 + 2] = data.data[i * 4 + 2];
            imageData.data[i * 4 + 3] = data.data[i * 4 + 3];
        }
        ctx.putImageData(imageData, 0, 0);
    });
</script>

<div>{name}</div>
<canvas bind:this={canvas} width={data.width} height={data.height} />