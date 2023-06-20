<script lang="ts">
  import { DoomWad, type DoomMap } from './doom';
  import Map from './lib/Map.svelte';
  import TextureDebug from './lib/TextureDebug.svelte';

  let wad: DoomWad;
  let debugMap: DoomMap;
  let doomMaps = [];
  (async () => {
    const buffer = await fetch('doom.wad').then(e => e.arrayBuffer());
    wad = new DoomWad(buffer);
    doomMaps = wad.maps;
    // debugMap = doomMaps[0];
    window.data = wad;
  })();

  let selectedMap: DoomMap = null
  $: if (selectedMap) {
    window.map = selectedMap;
  }
</script>

<main>
  {#each doomMaps as map}
    <button on:click={() => selectedMap = map}>{map.name}</button>
  {/each}

  {#if selectedMap}
    <Map {wad} map={selectedMap} />
  {/if}

  {#if debugMap}
    <TextureDebug {wad} map={debugMap} />
  {/if}
</main>

<style>

</style>
