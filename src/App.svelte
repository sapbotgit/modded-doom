<script lang="ts">
  import { DoomWad, Game, store, MapRuntime, type Skill, randInt } from './doom';
  import Doom from './render/Doom.svelte';
  import AABBSweepDebug from './render/Debug/AABBSweepDebug.svelte';
  // import Picture from './render/Components/Picture.svelte';
  // <Picture name="M_JKILL" />
  // <Picture name="M_ROUGH" />
  // <Picture name="M_HURT" />
  // <Picture name="M_ULTRA" />
  // <Picture name="M_NMARE" />

  let game: Game;
  let wad: DoomWad;
  let mapNames = [];
  (async () => {
    const buffer = await fetch('doom2.wad').then(e => e.arrayBuffer());
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
      compassMove: store(false),
      timescale: store(1),
      cameraMode: store('1p'),
  });

  let selectedMap: string = null
  $: if (game && selectedMap) {
    game.map.set(new MapRuntime(selectedMap, game));

    // // for testing intermisison screen
    // const finishedMap = new MapRuntime(selectedMap, game);
    // finishedMap.stats.elapsedTime = randInt(20, 200);
    // game.intermission.set({
    //   finishedMap,
    //   playerStats: [
    //     {
    //       items: randInt(0, finishedMap.stats.totalItems),
    //       kills: randInt(0, finishedMap.stats.totalKills),
    //       secrets: randInt(0, finishedMap.stats.totalSecrets),
    //     },
    //   ],
    //   nextMapName: `${selectedMap.substring(0, 3)}${parseInt(selectedMap.substring(3, 5)) + 1}`,
    // });
  }
</script>

<main>
  <!-- <AABBSweepDebug /> -->
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

    {#key game}
      <Doom {game} />
    {/key}
  {/if}
</main>
