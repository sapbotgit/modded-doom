<script lang="ts">
    import { onMount } from "svelte";
    import { useDoom } from "../useDoom";
    import { type DoomMap, type State } from "../../doom";

    export let map: DoomMap;
    export let state: State;
    export let frames: any[][];
    export let text: string;

    const { textures } = useDoom();

    const frameNum = state.frame & 0x7fff;
    const frame = frames[frameNum][8] ?? frames[frameNum][0];
    const data = textures.get(frame.name, 'sprite').image;

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

<div>{text}</div>
<canvas bind:this={canvas} width={data.width} height={data.height} />