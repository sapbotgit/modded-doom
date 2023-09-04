<script lang="ts">
    import DoomPic from "../DoomPic.svelte";

    export let name: string;
    export let type: 'wall' | 'flat';
</script>

<div>{name}</div>
<DoomPic {name} {type} />