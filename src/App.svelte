<script lang="ts">
  import { DoomWad, Game, store, MapRuntime, type Skill } from './doom';
  import Doom from './render/Doom.svelte';
  import SvgMap from './render/Debug/SvgMap.svelte';
  import GridTraceDebug from './render/Debug/GridTraceDebug.svelte';
  import AABBSweepDebug from './render/Debug/AABBSweepDebug.svelte';
  // import Picture from './render/Components/Picture.svelte';
  // <Picture name="M_JKILL" />
  // <Picture name="M_ROUGH" />
  // <Picture name="M_HURT" />
  // <Picture name="M_ULTRA" />
  // <Picture name="M_NMARE" />

  const svgMap = false;

  let game: Game;
  let wad: DoomWad;
  let mapNames = [];
  (async () => {
    const buffer = await fetch('doom.wad').then(e => e.arrayBuffer());
    wad = new DoomWad(buffer);
    mapNames = wad.mapNames;
    // selectedMap = wad.readMap('E2M3')
  })();

  let difficulty: Skill = 4;
  $: game = new Game(wad, difficulty, {
      freeFly: store(false),
      freelook: store(true),
      invicibility: store(false),
      noclip: store(false),
      timescale: store(1),
      cameraMode: store('1p'),
  });

  let selectedMap: string = null
  $: if (game && selectedMap) {
    game.map.set(new MapRuntime(selectedMap, game));
  }
</script>

<main>
  <!-- <AABBSweepDebug /> -->
  <!-- <GridTraceDebug /> -->
  <!-- <MathDebug /> -->

  {#if wad}
    <div>
      <label>
        <input type="radio" bind:group={difficulty} value={1} />
        I'm too young to die.
      </label>
      <label>
        <input type="radio" bind:group={difficulty} value={2} />
        Hey, not too rough.
      </label>
      <label>
        <input type="radio" bind:group={difficulty} value={3} />
        Hurt me plenty.
      </label>
      <label>
        <input type="radio" bind:group={difficulty} value={4} />
        Ultra Violence.
      </label>
      <label>
        <input type="radio" bind:group={difficulty} value={5} />
        Nightmare!
      </label>
    </div>
  {/if}

  <button on:click={() => selectedMap = null}>None</button>
  {#each mapNames as name}
    <button on:click={() => selectedMap = name}>{name}</button>
  {/each}

  {#if selectedMap}
    <div>{selectedMap}</div>

    <!-- {#if svgMap}
      <SvgMap map={selectedMap} {wad} />
    {/if} -->

    {#key game}
      <Doom {game} />
    {/key}
  {/if}
</main>
