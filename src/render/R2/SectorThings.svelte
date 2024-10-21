<script lang="ts">
    import { MapObjectIndex } from "../../doom";
    import Thing from "../Map/Thing.svelte";
    import { type RenderSector } from "../RenderData";

    export let renderSector: RenderSector;
    const mobjs = renderSector.mobjs;
    $: mo = [...$mobjs].sort((a, b) => a.id - b.id);

</script>

{#each mo as thing (thing.id)}
    {#if thing.type !== MapObjectIndex.MT_PLAYER}
        <Thing {renderSector} {thing} />
    {/if}
{/each}
