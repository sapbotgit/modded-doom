<script lang="ts">
    import { DoomWad, Game, MapRuntime, type Skill, randInt, data, WadFile } from './doom';
    import Doom from './render/Doom.svelte';
    import AABBSweepDebug from './render/Debug/AABBSweepDebug.svelte';
    import Picture from './render/Components/Picture.svelte';
    import { createAppContext } from './render/DoomContext';
    import { setContext } from 'svelte';
    import { fly } from 'svelte/transition';
    import WadScreen from './WadScreen.svelte';
    import { WadStore } from './WadStore';

    const wadStore = new WadStore();
    const context = createAppContext();
    setContext('doom-app-context', context);
    const { url, audio } = context;

    let wad: DoomWad;
    let game: Game;
    let difficulty: Skill = 3;
    $: mapNames = wad?.mapNames ?? [];
    $: mapName = mapNames.includes('E1M1') ? null : 'MAP01';

    async function parseUrl(url: string) {
        // TODO: this function needs more validation (like upper/lower case, bounds checks, etc)
        const parts = url.split('/').filter(e => e);

        const urlWads = parts[0];
        if (urlWads !== wad?.name) {
            if (urlWads) {
                // Does your wad have a + in the name? too bad, you'll find a bug :)
                const wadNames = urlWads.split('+');
                const wadResolvers = wadNames.map(name => wadStore.fetchWad(name).then(buff => new WadFile(name, buff)));
                const wads = await Promise.all(wadResolvers);
                wad = new DoomWad(urlWads, wads);
            } else {
                wad = null;
            }
        }

        const urlSkill = parseInt(parts[1]?.slice(-1));
        if (difficulty !== urlSkill) {
            difficulty = Math.min(5, Math.max(1, isFinite(urlSkill) ? urlSkill : difficulty)) as Skill;
            game = null;
        }

        const urlMapName = parts[2];
        if (urlMapName && (!game || game.map.val?.name !== urlMapName)) {
            game = new Game(wad, difficulty, context.settings);
            game.map.set(new MapRuntime(urlMapName, game));
        }
    }
    $: parseUrl($url);

    function enableSoundOnce() {
        audio.resume();
    }

    // // for testing intermisison screen
    // const finishedMap = new MapRuntime(selectedMap, game);
    //     finishedMap.stats.elapsedTime = randInt(20, 200);
    //     game.intermission.set({
    //     finishedMap,
    //     playerStats: [
    //         {
    //             items: randInt(0, finishedMap.stats.totalItems),
    //             kills: randInt(0, finishedMap.stats.totalKills),
    //             secrets: randInt(0, finishedMap.stats.totalSecrets),
    //         },
    //     ],
    //     nextMapName: `${selectedMap.substring(0, 3)}${parseInt(selectedMap.substring(3, 5)) + 1}`,
    // });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<main on:click|once={enableSoundOnce}>
    <!-- <AABBSweepDebug /> -->

    {#if game}
        {#key game}
            <Doom {game} />
        {/key}
    {:else if !wad}
        <WadScreen {wadStore} />
    {:else if wad}
        <!-- <AudioVisualizer context={audio} {wad} /> -->
        <div class="container mx-auto flex flex-col gap-2">
            <button class="btn btn-secondary w-64" on:click={() => $url = '/'}>❮ Select IWAD</button>
            <div
                class="h-64 grid justify-items-center items-center bg-base-300 rounded-box"
                class:grid-cols-[1fr_auto_1fr]={mapName?.startsWith('E')}
            >
                <span class="scale-[2]"><Picture {wad} name="M_DOOM" /></span>
                {#if mapName?.startsWith('E')}
                    <div class="divider divider-horizontal"></div>
                    {@const ep = parseInt(mapName[1])}
                    <button class="btn h-full relative" on:click={() => mapName = null}>
                        <span><Picture {wad} name={ep === 4 ? 'INTERPIC' : `WIMAP${ep - 1}`} /></span>
                        <span class="absolute bottom-0"><Picture {wad} name="M_EPI{ep}" /></span>
                    </button>
                {/if}
            </div>
            {#if mapNames.includes('E1M1') && !mapName}
                <span class="divider"><Picture {wad} name="M_EPISOD" /></span>
                <div class="grid grid-cols-2 gap-4">
                    {#each [1, 2, 3, 4] as ep}
                        {#if mapNames.includes(`E${ep}M1`)}
                            <button class="btn h-full relative" on:click={() => mapName = `E${ep}M1`}>
                                <span><Picture {wad} name={ep === 4 ? 'INTERPIC' : `WIMAP${ep - 1}`} /></span>
                                <span class="absolute bottom-0"><Picture {wad} name="M_EPI{ep}" /></span>
                            </button>
                        {/if}
                    {/each}
                </div>
            {:else}
                <span class="divider"><Picture {wad} name="M_SKILL" /></span>
                {#each data.skills as skill, i}
                    <button class="btn no-animation pulse-on-hover" in:fly={{ y: -60, delay: i * 50 }}
                        on:click={() => $url = `/${wad.name}/skill${skill.num}/${mapName}`}
                        class:skill-selected={difficulty === skill.num}
                    >
                        <Picture {wad} name={skill.pic} />
                    </button>
                {/each}
            {/if}
        </div>
    {:else}
        Loading...
    {/if}
</main>

<style>
    .pulse-on-hover:hover {
        animation: pulse-saturate .5s infinite alternate-reverse;
    }

    @keyframes pulse-saturate {
        0% { filter: saturate(1); }
        100% { filter: saturate(1.5); }
    }
</style>