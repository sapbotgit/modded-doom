<script lang="ts">
  import { DoomWad, type DoomMap } from './doom';
  import Map from './lib/Map.svelte';

  let doomMaps = [];
  (async () => {
    const buffer = await fetch('doom.wad').then(e => e.arrayBuffer());
    const data = new DoomWad(buffer);
    doomMaps = data.maps;
    window.data = data
  })();

  let selectedMap: DoomMap = null
</script>

<main>
  {#each doomMaps as map}
    <button on:click={() => selectedMap = map}>{map.name}</button>
  {/each}

  {#if selectedMap}
    <Map map={selectedMap} />
  {/if}
</main>

<style>

</style>
