<script lang="ts">
  import { DoomWad, type DoomMap } from './doom';
  import Map from './lib/Map.svelte';
  import MathDebug from './lib/Debug/MathDebug.svelte';
  import SvgMap from './lib/Debug/SvgMap.svelte';

  const svgMap = false;

  let wad: DoomWad;
  let mapNames = [];
  (async () => {
    const buffer = await fetch('doom.wad').then(e => e.arrayBuffer());
    wad = new DoomWad(buffer);
    mapNames = wad.mapNames;
    // selectedMap = wad.readMap('E2M3')
  })();

  let selectedMap: DoomMap = null
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
      <Map map={selectedMap} />
    {/key}
  {/if}
</main>
