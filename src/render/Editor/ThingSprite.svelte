<script lang="ts">
    import { type State } from "../../doom";
    import Picture from "../Components/Picture.svelte";

    export let state: State;
    export let frames: any[][];
    export let text: string;

    const frameNum = state.frame & 0x7fff;
    const frame = frames[frameNum][8] ?? frames[frameNum][0];
</script>

<div>{text}</div>
<Picture name={frame.name} />
