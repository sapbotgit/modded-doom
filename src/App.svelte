<script lang="ts">
  import { DoomWad, type DoomMap } from './doom';
  import Map from './lib/Map.svelte';
  import TextureDebug from './lib/Debug/TextureDebug.svelte';
  import MathDebug from './lib/Debug/MathDebug.svelte';
  import SvgMap from './lib/Debug/SvgMap.svelte';

  const svgMap = false;

  let wad: DoomWad;
  let debugMap: DoomMap;
  let mapNames = [];
  (async () => {
    const buffer = await fetch('doom2.wad').then(e => e.arrayBuffer());
    wad = new DoomWad(buffer);
    mapNames = wad.mapNames;
    // debugMap = wad.readMap(mapNames[0]);
    // selectedMap = wad.readMap('E2M3')
    window.data = wad;
  })();

  let selectedMap: DoomMap = null
  $: if (selectedMap) {
    window.map = selectedMap;
  }
</script>

<main>
  <!-- <MathDebug /> -->

  <button on:click={() => selectedMap = null}>None</button>
  {#each mapNames as name}
    <button on:click={() => selectedMap = wad.readMap(name)}>{name}</button>
  {/each}

  {#if selectedMap}
    <div>{selectedMap.name}</div>

    {#if svgMap}
      <SvgMap map={selectedMap} {wad} />
    {/if}

    {#key selectedMap.name}
      <Map {wad} map={selectedMap} />
    {/key}
  {/if}

  {#if debugMap}
    <TextureDebug {wad} map={debugMap} />
  {/if}
</main>

<style>

</style>
