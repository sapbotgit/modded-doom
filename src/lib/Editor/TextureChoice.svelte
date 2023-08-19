<script lang="ts">
    import { useDoom } from "../useDoom";
    import DoomPic from "../DoomPic.svelte";

    export let name: string;
    export let type: 'wall' | 'flat';

    const { textures } = useDoom();
    const data = textures.get(name, type).image;
</script>

<div>{name}</div>
<DoomPic {data} />