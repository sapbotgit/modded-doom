<script lang="ts" context="module">
    export function reveal(_: Element, { delay = 0, duration = 400, easing = cubicOut } = {}) {
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `clip-path: inset(0% 0% ${u * 100}% 0%);`,
        };
    }
</script>
<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import type { DoomWad } from "../../doom";
    import TextureChoice from "./TextureChoice.svelte";
    import { cubicOut } from "svelte/easing";

    export let type: 'wall' | 'flat';
    export let label: string;
    export let value: string;
    export let wad: DoomWad;

    const dispatch = createEventDispatcher();

    let showOptions = false;
    function toggleDropdown() {
        showOptions = !showOptions;
    }

    let selectorFilter = '';
    function change(val: string) {
        value = val;
        selectorFilter = '';
        toggleDropdown();
        dispatch('change');
    }

    const options = type == 'flat' ? wad.flatsNames() : wad.texturesNames();
</script>

<div class="relative flex flex-col">
    <span class="z-20 absolute top-0 left-2 italic">{label}</span>
    <button class="btn h-full min-h-20" on:click={toggleDropdown}>
        {#if value}
            <TextureChoice name={value} {type} />
        {:else}
            None
        {/if}
    </button>
    {#if showOptions}
    <div class="relative">
        <div transition:reveal class="z-30 absolute top-0 left-0 p-2 max-w-xl flex flex-col shadow-2xl bg-neutral rounded-box">
            <!-- svelte-ignore a11y-autofocus -->
            <input autofocus type="text" placeholder="Search..." autocomplete="off" class="input" bind:value={selectorFilter} on:input>
            <div class="overflow-y-scroll max-h-96 flex flex-wrap gap-2 pt-2">
                <button class="btn btn-accent w-full relative" on:click={() => change(null)}>None</button>
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
