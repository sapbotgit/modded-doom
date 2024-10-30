<script lang="ts">
    import Picture from "../Components/Picture.svelte";
    import { useDoom } from "../DoomContext";

    const { wad } = useDoom();

    export let name: string;
    export let type: 'wall' | 'flat';
    const tx = type === 'flat' ? wad.flatTextureData(name) : wad.wallTextureData(name);
</script>

{#if tx}
    <div class="absolute bottom-0 text-xs">{name} ({tx.width}x{tx.height})</div>
    <Picture {name} {type} />
{:else}
    <div class="absolute bottom-0 text-xs">{name} (MISSING)</div>
{/if}