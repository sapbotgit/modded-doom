<script lang="ts">
    import { WadStore, type WADInfo } from "./WadStore";
    import { useAppContext } from "./render/DoomContext";
    import WarningIcon from './render/Icons/WarningIcon.svelte'
    import WadDropbox from "./WadDropbox.svelte";

    const { urlHash } = useAppContext();

    export let wadStore: WadStore;
    const wads = wadStore.wads;
    $: iWads = $wads.filter(wad => wad.iwad);
    $: pWads = $wads.filter(wad => !wad.iwad);

    let selectedIWad: WADInfo;
    let selectedPWads: WADInfo[] = [];
    $: if (selectedIWad) {
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
        return `${wad.mapCount} maps` + (wad.episodicMaps ? ' (episodes)' : '');
    }

    // TODO: it would be really nice to get transitions between the screens...
</script>

<div class="container mx-auto flex flex-col gap-2">
    {#if selectedIWad}
        <button class="btn btn-secondary w-64" on:click={() => selectedIWad = null}>❮ Select IWAD</button>
    {/if}

    {#if iWads.length}
        <div class="divider">Game WADS (<a class="link link-primary" href="https://doomwiki.org/wiki/IWAD" target="_blank" rel="noreferrer" >IWADs</a>)</div>
        {#if selectedIWad}
            <div class="flex flex-col sm:flex-row w-full">
                <div class="grid flex-grow bg-base-300 rounded-box place-items-center">
                    <img src={selectedIWad.image} alt={selectedIWad.name} />
                </div>
                {#if selectedPWads.length}
                    <div class="divider sm:divider-horizontal">+</div>
                    <div class="flex flex-wrap max-w-64 gap-2 p-4 bg-base-300 rounded-box place-items-center">
                        {#each selectedPWads as pwad}
                            <div class="badge badge-primary badge-lg">{pwad.name}</div>
                        {/each}
                    </div>
                {/if}
            </div>
            <button
                class="btn btn-primary w-full"
                on:click={() => $urlHash = `#${[selectedIWad, ...selectedPWads].map(p => `wad=${p.name}`).join('&')}`}
            >Launch</button>
        {:else}
            <div class="grid sm:grid-cols-2 mx-auto gap-4">
                {#each iWads as wadInfo (wadInfo.name)}
                    <div class="flex flex-col relative">
                        <button class="btn h-auto" on:click={() => selectedIWad = wadInfo}>
                            <img src={wadInfo.image} alt={wadInfo.name} />
                        </button>
                        <label class="swap swap-flip absolute bottom-0 right-0">
                            <input type="checkbox" />
                            <div class="btn btn-square swap-off justify-self-end self-end">{'🗑️'}</div>
                            <div role="alert" class="swap-on alert alert-warning grid-flow-col">
                                <WarningIcon />
                                <span>Remove: Are you sure?</span>
                                <div>
                                    <button class="btn" on:click|stopPropagation={() => wadStore.removeWad(wadInfo.name)}>Yes</button>
                                    <span class="btn">No</span>
                                </div>
                            </div>
                        </label>
                    </div>
                {/each}
            </div>
        {/if}
    {:else}
        <div class="flex place-items-center justify-center min-h-48">
            <span>
                No game <a class="link link-primary" href="https://doomwiki.org/wiki/IWAD" target="_blank" rel="noreferrer" >IWADs</a> found.
            </span>
        </div>
    {/if}

    {#if selectedIWad && pWads.length}
        <div class="collapse collapse-arrow text-center bg-base-300">
            <input type="checkbox"/>
            <div class="collapse-title text-xl font-medium">
                Addons (<a class="link link-primary" href="https://doomwiki.org/wiki/PWAD" target="_blank" rel="noreferrer" >PWADs</a>)
            </div>
            <div class="collapse-content">
                <div class="overflow-x-auto max-h-96">
                    <table class="table table-zebra table-pin-rows">
                    <thead>
                        <tr>
                            <th>Enabled</th>
                            <th>Name</th>
                            <th>Details</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each pWads as pwad (pwad.name)}
                            <tr>
                                <td><input type="checkbox" class="checkbox" checked={selectedPWads.includes(pwad)} on:change={() => pwadChange(pwad)} /></td>
                                <td>{pwad.name}</td>
                                <td>{detailsString(pwad)}</td>
                                <td>
                                    <label class="swap swap-flip">
                                        <input type="checkbox" />
                                        <div class="btn btn-square swap-off fill-current justify-self-end self-end">{'🗑️'}</div>
                                        <div class="swap-on fill-current alert alert-warning">
                                            <WarningIcon />
                                            <span>Remove: Are you sure?</span>
                                            <div>
                                                <button class="btn" on:click|stopPropagation={() => wadStore.removeWad(pwad.name)}>Yes</button>
                                                <span class="btn">No</span>
                                            </div>
                                        </div>
                                    </label>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                    </table>
                </div>
                <WadDropbox {wadStore} />
            </div>
        </div>
    {:else}
        <div class="px-8">
            <WadDropbox {wadStore} />
        </div>
    {/if}
</div>
