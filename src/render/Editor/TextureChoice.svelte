<script lang="ts">
    import Picture from "../Components/Picture.svelte";
    import { useDoom } from "../DoomContext";

    const { wad } = useDoom();

    export let name: string;
    export let type: 'wall' | 'flat';
    const tx = type === 'flat' ? wad.flatTextureData(name) : wad.wallTextureData(name);
</script>

<div>{name} ({tx.width}x{tx.height})</div>
<Picture {name} {type} />
