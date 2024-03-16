<script lang="ts">
    import { WadStore, type WADInfo } from "./WadStore";
    import { useAppContext } from "./render/DoomContext";
    import WadDropbox from "./WadDropbox.svelte";
	import { crossfade, fade, fly, scale } from 'svelte/transition';

    const { urlHash } = useAppContext();
    const [send, receive] = crossfade({
		duration: 300,
		fallback: scale
	});

    export let wadStore: WadStore;
    const wads = wadStore.wads;
    $: iWads = $wads.filter(wad => wad.iwad);
    $: pWads = $wads.filter(wad => !wad.iwad);

    // used for exit transition. For some reason selectedIWad.name is always null
    let selectedWadName: string;
    let selectedIWad: WADInfo;
    let selectedPWads: WADInfo[] = [];
    $: if (selectedIWad) {
        selectedWadName = selectedIWad.name;
        selectedPWads = [];
    }

    function pwadChange(pwad: WADInfo) {
        if (selectedPWads.includes(pwad)) {
            selectedPWads = selectedPWads.filter(pw => pw !== pwad)
        } else {
            selectedPWads = [...selectedPWads, pwad]
        }
    }

    function detailsString(wad: WADInfo) {
        return `${wad.mapCount} maps` + (wad.episodicMaps ? ' (episodic)' : '');
    }
</script>

<div out:fade class="
    container mx-auto grid grid-cols-1 grid-rows-1 p-2 bg-base-100 justify-center
    md:rounded-box md:shadow-2xl
">
    {#if !iWads.length}
    <div class="flex flex-col place-items-center justify-center min-h-48">
        <p>No game <a class="link link-primary" href="https://doomwiki.org/wiki/IWAD" target="_blank" rel="noreferrer" >IWADs</a> found.</p>
        <p>To start playing DOOM, drag and drop DOOM WAD files into the drop box below.</p>
        <p>Don't have any DOOM WADs? Download and use the <a class="link link-primary" href="https://distro.ibiblio.org/slitaz/sources/packages/d/doom1.wad">DOOM shareware WAD</a>.</p>
    </div>
    {:else}
    <div class="flex flex-col gap-2">
        <div class="grid sm:grid-cols-2 mx-auto gap-4">
            {#each iWads as wad (wad.name)}
                {#if selectedIWad !== wad}
                <button
                    class="btn h-auto no-animation"
                    on:click={() => selectedIWad = wad}
                    in:receive={{ key: wad.name }}
                    out:send={{ key: wad.name }}
                >
                    <img src={wad.image} alt={wad.name} />
                </button>
                {/if}
            {/each}
        </div>
        <div class="p-8 max-w-6xl mx-auto">
            <WadDropbox {wadStore} />
        </div>
    </div>
    {/if}

    {#if selectedIWad}
    <div class="card image-full bg-base-200 shadow-xl absolute inset-0"
        in:receive={{ key: selectedIWad.name }}
        out:send={{ key: selectedWadName }}
    >
        <figure><img class="flex-grow h-64 object-cover" src={selectedIWad.image} alt={selectedIWad.name} /></figure>
        <div class="card-body justify-end">
            <h2 class="card-title">
                <span>{selectedIWad.name}</span>
                {#if selectedPWads.length}
                <div class="divider sm:divider-horizontal">+</div>
                <div class="flex flex-wrap gap-2 p-4 bg-base-300 rounded-box place-items-center">
                    {#each selectedPWads as pwad}
                        <div class="badge badge-primary badge-lg">{pwad.name}</div>
                    {/each}
                </div>
                {/if}
            </h2>
            <div class="card-actions">
                <div transition:fly={{ delay: 200, y: '-100%' }} class="flex gap-2 absolute top-0 left-0">
                    <button class="btn btn-secondary w-48" on:click={() => (selectedIWad = null)}>❮ Select IWAD</button>
                </div>
                <div class="flex w-full gap-2"
                    transition:fly={{ delay: 200, y: '100%' }}
                >
                    <button
                        class="btn btn-primary btn-lg flex-grow no-animation"
                        on:click={() => $urlHash = `#${[selectedIWad, ...selectedPWads].map(p => `wad=${p.name}`).join('&')}`}
                    >Play</button>
                    {#if pWads.length}
                    <div class="dropdown dropdown-top flex-shrink">
                        <!-- <input type="checkbox"/> -->
                        <div tabindex="0" role="button" class="btn btn-lg min-w-80">
                            Addons (<a class="link link-primary" href="https://doomwiki.org/wiki/PWAD" target="_blank" rel="noreferrer" >PWADs</a>)
                        </div>
                        <ul tabindex="-1" class="dropdown-content menu flex-nowrap max-h-64 overflow-scroll bg-base-300">
                            <li><button class="btn btn-sm" on:click={() => selectedPWads = []}>Clear selection</button></li>
                            {#each pWads as pwad (pwad.name)}
                                {@const checked = selectedPWads.includes(pwad)}
                                <li>
                                    <label class="label cursor-pointer">
                                        <span class="label-text">{pwad.name} <span class="text-xs">[{detailsString(pwad)}]</span></span>
                                        <input type="checkbox" class="checkbox" {checked} on:change={() => pwadChange(pwad)} />
                                    </label>
                                </li>
                            {/each}
                        </ul>
                    </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
    {/if}
</div>

<style>
    .container {
        min-height: min(100vh, 36rem);
    }

    .card.image-full::before {
        opacity: 0.5;
    }
</style>