<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import type { DoomWad } from "../../doom";
    import TextureChoice from "./TextureChoice.svelte";

    export let type: 'wall' | 'flat';
    export let value: string;
    export let wad: DoomWad;

    const dispatch = createEventDispatcher();

    let showSelector = false;
    let selectorFilter = '';
    function toggleSelector() {
        showSelector = !showSelector;
    }

    function change(val: string) {
        value = val;
        selectorFilter = '';
        showSelector = false;
        dispatch('change');
    }

    const options = type == 'flat' ? wad.flatsNames() : wad.texturesNames();
</script>

<button class="btn" on:click={toggleSelector}>
    {#if value}
        <TextureChoice name={value} {type} />
    {:else}
        {value}
    {/if}
</button>
<div>
    {#if showSelector}
        <div class="selector">
            <input autofocus type="text" placeholder="Search..." autocomplete="off" id="searchInput" bind:value={selectorFilter} on:input>
            <div class="options">
                {#each options as o}
                    {#if !selectorFilter.length || o.toLowerCase().includes(selectorFilter)}
                        <button class="btn" on:click={() => change(o)}>
                            <TextureChoice name={o} {type} />
                        </button>
                    {/if}
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    div {
        position: relative;
    }

    .selector {
        z-index: 1;
        position: absolute;
        top: 0;
        left: 0;
        max-width: 30em;
        display: flex;
        flex-direction: column;
        background: #1a1a1a;
    }

    .options {
        overflow-y: scroll;
        max-height: 30em;
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
    }
</style>
