<script lang="ts">
    import type { DoomWad } from "../../doom";
    import TextureChoice from "./TextureChoice.svelte";

    export let type: 'wall' | 'flat';
    export let value: string;
    export let wad: DoomWad;

    let showSelector = false;
    let selectorFilter = '';
    function toggleSelector() {
        showSelector = !showSelector;
    }

    function change(val: string) {
        value = val;
        selectorFilter = '';
        showSelector = false;
    }

    const options = type == 'flat' ? wad.flatsNames() : wad.texturesNames();
</script>

<button on:click={toggleSelector}>{value}</button>
{#if showSelector}
    <div class="selector">
        <input autofocus type="text" placeholder="Search..." autocomplete="off" id="searchInput" bind:value={selectorFilter} on:input>
        {#each options as o}
            {#if !selectorFilter.length || o.toLowerCase().includes(selectorFilter)}
                <button on:click={() => change(o)}>
                    <TextureChoice name={o} {type} />
                </button>
            {/if}
        {/each}
    </div>
{/if}

<style>
    div {
        position: relative;
    }

    .selector {
        z-index: 1;
        overflow-y: scroll;
        max-height: 30em;
        position: absolute;
        display: flex;
        flex-direction: column;
    }
</style>
