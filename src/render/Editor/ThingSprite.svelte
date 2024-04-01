<script lang="ts">
    import { type State } from "../../doom";
    import Picture from "../Components/Picture.svelte";

    export let state: State;
    export let frames: any[][];
    export let text: string;

    const frameNum = state.frame & 0x7fff;
    const frame = frames[frameNum][8] ?? frames[frameNum][0];
</script>

<div class="text-xs z-10">{text}</div>
<div class="scale-[1.5] translate-x-10">
    <Picture name={frame.name} />
</div>
