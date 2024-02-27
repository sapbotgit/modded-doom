<script lang="ts">
    import { DoomWad, Game, MapRuntime, type Skill, data, WadFile } from './doom';
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
            game.map.set(new MapRuntime(urlMapName, game));
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

    {#if game}
        {#key game}
            <Doom {game} />
        {/key}
    {:else if !wad}
        <WadScreen {wadStore} />
    {:else if wad}
        <div class="container mx-auto flex flex-col gap-2 pb-8">
            <button class="btn btn-secondary w-64" on:click={() => $urlHash = '#'}>❮ Select IWAD</button>
            <div
                class="h-32 grid justify-items-center items-center bg-base-300 rounded-box"
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

    :root {
        --line-width: 12px;
        background-image:
                radial-gradient(#0c4a6e, #000),
                repeating-linear-gradient(transparent 0, rgba(0,0,0,0.1) calc(var(--line-width)/2), transparent var(--line-width));
        /* animation: scan-lines 1s infinite alternate-reverse; */
        background-size: cover;
        background-position: 0px 0px;
        background-blend-mode: overlay;
        width: 100vw;
        height: 100vh;
    }

    @keyframes scan-lines {
        0% { background-position: 0px 0px; }
        12% { background-position: 0px 1px; }
        28% { background-position: 0px 4px; }
        42% { background-position: 0px 7px; }
        61% { background-position: 0px 12px; }
        65% { background-position: 0px 9px; }
        84% { background-position: 0px 8px; }
        92% { background-position: 0px 3px; }
        100% { background-position: 0px 1px; }
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