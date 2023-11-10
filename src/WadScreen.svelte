<script lang="ts">
    import { fade, fly, scale } from "svelte/transition";
    import { WadStore, type WADInfo } from "./WadStore";
    import TwoStepDeleteButton from "./render/Components/TwoStepDeleteButton.svelte";
    import { useAppContext } from "./render/DoomContext";

    const { url } = useAppContext();

    export let wadStore: WadStore;
    const wads = wadStore.wads;
    $: iWads = $wads.filter(wad => wad.iwad);
    $: pWads = $wads.filter(wad => !wad.iwad);

    let selectedIWad: WADInfo;
    let selectedPWads: WADInfo[] = [];
    let pwadsCollapsed = true; // always hide pwad stuff by default because I assume it's no the common case...

    let wadFiles: FileList;
    $: if (wadFiles) {
        // store files in wad store
        for (const file of wadFiles) {
            file.arrayBuffer().then(buff => wadStore.saveWad(file.name, buff));
        }
    }

    function detailsString(wad: WADInfo) {
        return `${wad.mapCount} maps` + (wad.episodicMaps ? ' (episodes)' : '');
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop
    let fileDropActive = false;
    function fileDropHandler(ev: DragEvent) {
        fileDropActive = false;
        if (ev.dataTransfer.items) {
            // Use DataTransferItemList interface to access the file(s)
            Promise.all([...ev.dataTransfer.items].map(async item => {
                // If dropped items aren't files, reject them
                if (item.kind === "file") {
                    const file = item.getAsFile();
                    wadStore.saveWad(file.name, await file.arrayBuffer());
                }
            }));
        } else {
            // Use DataTransfer interface to access the file(s)
            [...ev.dataTransfer.files].forEach(async (file, i) => {
                wadStore.saveWad(file.name, await file.arrayBuffer());
            });
        }
    }
</script>

<div class="root">
    <div class="controls">
        {#if selectedIWad}
            <button
                in:fly={{ y: 30 }}
                on:click={() => $url = `/${[selectedIWad.name, ...selectedPWads.map(p => p.name)].join('+')}`}
            >
                Play Doom [{selectedIWad.name}]
                {#if selectedPWads.length}
                    <br>(+ {selectedPWads.map(pwad => pwad.name).join(',')})
                {/if}
            </button>
        {/if}
    </div>

    {#if iWads.length}
        <div>Game WADS (<a href="https://doomwiki.org/wiki/IWAD" target="_blank" rel="noreferrer" >IWADs</a>)</div>
        {#if selectedIWad}
            <button on:click={() => selectedIWad = null}>
                <img src={selectedIWad.image} alt={selectedIWad.name} />
            </button>
        {:else}
            <div class="option-grid">
                {#each iWads as wadInfo}
                    <button class="game-wad" on:click={() => selectedIWad = wadInfo}>
                        <img src={wadInfo.image} alt={wadInfo.name} />
                        <div><TwoStepDeleteButton on:click={() => wadStore.removeWad(wadInfo.name)}>{'🗑️'}</TwoStepDeleteButton></div>
                    </button>
                {/each}
            </div>
        {/if}
    {/if}

    {#if pWads.length}
        {#if pwadsCollapsed}
        <div>
            <button on:click={() => pwadsCollapsed = false}>
                Addons (<a href="https://doomwiki.org/wiki/PWAD" target="_blank" rel="noreferrer" >PWADs</a>)
            </button>
        </div>
        {:else}
            <div>Addons (<a href="https://doomwiki.org/wiki/PWAD" target="_blank" rel="noreferrer" >PWADs</a>)</div>
            <div in:fade class="wad-list">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th></th>
                            <th>Details</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each pWads as pwad (pwad.name)}
                            <tr>
                                <td>{pwad.name}</td>
                                <td>
                                    {#if selectedIWad}
                                        {#if selectedPWads.includes(pwad)}
                                            <button on:click={() => selectedPWads = selectedPWads.filter(pw => pw !== pwad)}>Deactivate</button>
                                        {:else}
                                            <button on:click={() => selectedPWads = [...selectedPWads, pwad]}>Activate</button>
                                        {/if}
                                    {/if}
                                </td>
                                <td>{detailsString(pwad)}</td>
                                <td><TwoStepDeleteButton on:click={() => wadStore.removeWad(pwad.name)}>{'🗑️'}</TwoStepDeleteButton></td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    {/if}

    <div class="dropzone"
        class:drop-active={fileDropActive}
        on:drop|preventDefault={fileDropHandler}
        on:dragover|preventDefault
        on:dragenter={() => fileDropActive = true}
        on:dragleave={() => fileDropActive = false}
    >
        Drop a
        <a class:disable-pointer={fileDropActive} target="_blank" rel="noreferrer" href="https://zdoom.org/wiki/IWAD">Doom WAD</a> here or
        <label class="file-input" for="files">browse for files</label>
        <input type="file" id="files" name="files" multiple bind:files={wadFiles}>
    </div>
</div>

<style>
    .root {
        display: flex;
        flex-direction: column;
        gap: 1em;
    }

    .wad-list {
        display: flex;
        flex-direction: column;
        gap: .5em;
        max-height: 30em;
        overflow-y: scroll;
    }

    .option-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        gap: .5em;
    }
    .game-wad {
        position: relative;
    }
    .game-wad div {
        top: 0;
        right: 0;
        position: absolute;
    }
    .game-wad img {
        width: 100px;
    }

    table {
        table-layout: fixed;
        border-collapse: collapse;
        min-height: 12em;
        max-height: 16em;
        width: 100%;
        display: block;
        overflow-y: scroll;
    }
    thead th:nth-child(1) {
        width: 100%;
    }
    th {
        position: sticky;
        top: 0;
        text-align: left;
        background: #242424;
        padding: 1em .5em;
    }
    tbody tr:nth-child(even) {
        background: rgb(200, 200, 200, 0.2);
    }

    .controls {
        display: flex;
        flex-direction: column;
    }

    .dropzone {
        padding: 2em 1em;
        border: 2px dashed #fefc7b;
        border-radius: 3px;
    }
    .drop-active {
        background: black;
    }
    .disable-pointer {
        pointer-events: none;
    }

    #files {
        display: none;
    }
    .file-input {
        border-radius: 8px;
        border: 1px solid transparent;
        padding: 0.6em 1.2em;
        font-size: 1em;
        font-weight: 500;
        font-family: inherit;
        background-color: #1a1a1a;
        cursor: pointer;
        transition: border-color 0.25s;
    }
    .file-input:hover {
        border-color: #646cff;
    }
    .file-input:focus,
    .file-input:focus-visible {
        outline: 4px auto;
    }
</style>