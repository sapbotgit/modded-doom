<script lang="ts">
    import { DoomWad, Game, MapRuntime, type Skill, data, WadFile } from './doom';
    import Doom from './render/Doom.svelte';
    import AABBSweepDebug from './render/Debug/AABBSweepDebug.svelte';
    import AppInfo from './render/Components/AppInfo.svelte';
    import Picture, { imageDataUrl } from './render/Components/Picture.svelte';
    import { createAppContext } from './render/DoomContext';
    import { setContext } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import WadScreen from './WadScreen.svelte';
    import { WadStore } from './WadStore';

    const wadStore = new WadStore();
    const context = createAppContext();
    setContext('doom-app-context', context);
    const { urlHash, audio } = context;

    let wad: DoomWad;
    let game: Game;
    let difficulty: Skill = 3;
    $: mapNames = wad?.mapNames ?? [];
    $: mapName = mapNames.includes('E1M1') ? null : 'MAP01';

    async function parseUrlHash(url: string) {
        // TODO: this function needs more validation (like upper/lower case, bounds checks, etc)
        const params = new URLSearchParams(url.substring(1));

        const wadNames = params.getAll('wad');
        const urlWads = wadNames.map(wad => `wad=${wad}`).join('&');
        if (urlWads !== wad?.name) {
            if (urlWads) {
                const wadResolvers = wadNames.map(name => wadStore.fetchWad(name).then(buff => new WadFile(name, buff)));
                const wads = await Promise.all(wadResolvers);
                wad = new DoomWad(urlWads, wads);
            } else {
                wad = null;
            }
        }

        const urlSkill = parseInt(params.get('skill'));
        if (difficulty !== urlSkill) {
            difficulty = Math.min(5, Math.max(1, isFinite(urlSkill) ? urlSkill : difficulty)) as Skill;
            game = null;
        }

        const urlMapName = params.get('map');
        if (urlMapName && (!game || game.map.val?.name !== urlMapName)) {
            game = new Game(wad, difficulty, context.settings);
            game.startMap(new MapRuntime(urlMapName, game));
        }
    }
    $: parseUrlHash($urlHash);

    async function startGame(skill: number) {
        await context.pointerLock.requestLock();
        $urlHash = `#${wad.name}&skill=${skill}&map=${mapName}`;
    }

    function enableSoundOnce() {
        audio.resume();
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<main
    on:click|once={enableSoundOnce}
    use:context.pointerLock.pointerLockControls
>
    <!-- <AABBSweepDebug /> -->

    {#if !game}
    <AppInfo />
    {/if}

    {#if game}
        {#key game}
            <Doom {game} />
        {/key}
    {:else if !wad}
        <WadScreen {wadStore} />
    {:else if wad}
        <div in:fade class="
            container mx-auto grid grid-cols-1 grid-rows-1 p-2 bg-base-100 justify-center
            md:rounded-box md:shadow-2xl
        ">
            <div class="card image-full bg-base-200 shadow-xl absolute inset-0">
                <button class="btn btn-secondary w-48 flex-none absolute top-0 left-0 z-30" on:click={() => $urlHash = '#'}>❮ Select IWAD</button>
                <figure><img class="flex-grow h-64 object-cover" src={imageDataUrl(wad, 'TITLEPIC', 'any')} alt="" /></figure>
                <div class="card-body justify-self-center pt-16">
                    <div
                        class="h-32 grid justify-items-center items-center bg-base-200 rounded-box"
                        class:grid-cols-[1fr_auto_1fr]={mapName?.startsWith('E')}
                    >
                        <span class="scale-[2]"><Picture {wad} name="M_DOOM" /></span>
                        {#if mapName?.startsWith('E')}
                            <div class="divider divider-horizontal"></div>
                            {@const ep = parseInt(mapName[1])}
                            <button class="btn h-full relative overflow-hidden" on:click={() => mapName = null}>
                                <span class="scale-[2]"><Picture {wad} name={ep === 4 ? 'INTERPIC' : `WIMAP${ep - 1}`} /></span>
                                <span class="absolute bottom-0"><Picture {wad} name="M_EPI{ep}" /></span>
                            </button>
                        {/if}
                    </div>
                    {#if mapNames.includes('E1M1') && !mapName}
                    <div class="bg-base-300 rounded-box shadow-xl p-4">
                        <span class="divider"><Picture {wad} name="M_EPISOD" /></span>
                        <!-- Why an extra div? Safari https://stackoverflow.com/questions/44770074 -->
                        <div>
                            <div class="grid sm:grid-cols-2 gap-4 mx-auto">
                                {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as ep}
                                    {#if mapNames.includes(`E${ep}M1`)}
                                        <button class="btn h-full relative overflow-hidden" on:click={() => mapName = `E${ep}M1`}>
                                            <span class="scale-[2]"><Picture {wad} name={ep > 3 ? 'INTERPIC' : `WIMAP${ep - 1}`} /></span>
                                            <span class="absolute bottom-0"><Picture {wad} name="M_EPI{ep}" /></span>
                                        </button>
                                    {/if}
                                {/each}
                            </div>
                        </div>
                    </div>
                    {:else}
                        <span class="divider"><Picture {wad} name="M_SKILL" /></span>
                        {#each data.skills as skill, i}
                            <button class="btn no-animation pulse-on-hover" in:fly={{ y: -60, delay: i * 50 }}
                                on:click={() => startGame(skill.num)}
                                class:skill-selected={difficulty === skill.num}
                            >
                                <Picture {wad} name={skill.pic} />
                            </button>
                        {/each}
                    {/if}
                    <div class="card-actions">
                    </div>
                </div>
            </div>
        </div>
    {/if}
</main>

<style>
    .container {
        min-height: min(100vh, 36rem);
    }

    .pulse-on-hover:hover {
        animation: pulse-saturate .5s infinite alternate-reverse;
    }

    @keyframes pulse-saturate {
        0% { filter: saturate(1); }
        100% { filter: saturate(1.5); }
    }

    :root {
        --line-width: 12px;
        --honeycomb-size: 40px;
        background: var(--honeycomb-gradient);
        background-size: var(--honeycomb-size-x) var(--honeycomb-size-y);
        width: 100vw;
        height: 100vh;
    }

    /*
        safari hack to make sure we can scroll to hide the address bar...
        See also the note in Doom.svelte
    */
    @supports (-webkit-touch-callout: none) {
        @media only screen and (orientation: landscape) {
            main {
                padding-top: 60px;
            }
        }
    }
</style>