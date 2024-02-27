<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import type { DoomWad } from "../../doom";
    import TextureChoice from "./TextureChoice.svelte";

    export let type: 'wall' | 'flat';
    export let label: string;
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

<div class="relative">
    <span class="label">{label}</span>
    <button class="btn h-full relative" on:click={toggleSelector}>
        {#if value}
            <TextureChoice name={value} {type} />
        {:else}
            None
        {/if}
    </button>
    {#if showSelector}
    <div class="relative">
        <div class="z-10 absolute top-0 left-0 max-w-xl flex flex-col bg-base-300 rounded-box shadow">
            <!-- svelte-ignore a11y-autofocus -->
            <input autofocus type="text" placeholder="Search..." autocomplete="off" class="input w-full" bind:value={selectorFilter} on:input>
            <div class="overflow-y-scroll max-h-96 flex flex-wrap gap-2 pt-2">
                <button class="btn btn-wide btn-accent h-full relative" on:click={() => change(null)}>None</button>
                {#each options as o}
                    {#if !selectorFilter.length || o.toLowerCase().includes(selectorFilter)}
                        <button class="btn h-full relative" on:click={() => change(o)}>
                            <TextureChoice name={o} {type} />
                        </button>
                    {/if}
                {/each}
            </div>
        </div>
    </div>
    {/if}
</div>
