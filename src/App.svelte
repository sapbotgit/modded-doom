<script lang="ts">
  import { DoomWad, Game, store, MapRuntime, type Skill, type Picture } from './doom';
  import Doom from './lib/Doom.svelte';
  import MathDebug from './lib/Debug/MathDebug.svelte';
  import SvgMap from './lib/Debug/SvgMap.svelte';
  import { Object3D } from 'three';

  const svgMap = false;

  Object3D.DEFAULT_UP.set(0, 0, 1);

  let game: Game;
  let wad: DoomWad;
  let mapNames = [];
  (async () => {
    const buffer = await fetch('doom.wad').then(e => e.arrayBuffer());
    wad = new DoomWad(buffer);
    mapNames = wad.mapNames;
    // selectedMap = wad.readMap('E2M3')
  })();

  let difficulty: Skill = 3;
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
  <!-- <MathDebug /> -->

  <button on:click={() => selectedMap = null}>None</button>
  {#each mapNames as name}
    <button on:click={() => selectedMap = name}>{name}</button>
  {/each}

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
