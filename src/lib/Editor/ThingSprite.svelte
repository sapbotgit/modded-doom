<script lang="ts">
    import { useDoom } from "../DoomContext";
    import { type State } from "../../doom";
    import DoomPic from "../DoomPic.svelte";

    export let state: State;
    export let frames: any[][];
    export let text: string;

    const { textures } = useDoom();

    const frameNum = state.frame & 0x7fff;
    const frame = frames[frameNum][8] ?? frames[frameNum][0];
    const data = textures.get(frame.name, 'sprite').image;
</script>

<div>{text}</div>
<DoomPic {data} />
