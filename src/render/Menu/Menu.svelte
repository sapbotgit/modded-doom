<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { useAppContext, useDoom } from "../DoomContext";
    import MenuItem from "./MenuItem.svelte";
    import MapNamePic from "../Components/MapNamePic.svelte";
    import Picture from "../Components/Picture.svelte";
    import { data } from "../../doom";
    import MapStats from "./MapStats.svelte";
    import CheatsMenu from "./CheatsMenu.svelte";
    import KeyboardControlsMenu from "./KeyboardControlsMenu.svelte";
    import TouchControlsMenu from "./TouchControlsMenu.svelte";
    import type { Size } from "@threlte/core";

    export let requestLock: () => void;
    export let viewSize: Size;

    const { settingsMenu, editor } = useAppContext();
    const { game } = useDoom();
    const { intermission, map } = game;
    const touchDevice = matchMedia('(hover: none)').matches;
    // a hack to allow a fullscreen menu for configuring touch controls
    let showTouchControls = false;

    const settings = {
        Normal: settingsMenu.filter((e) => e.cat === "normal"),
        Advanced: settingsMenu.filter((e) => e.cat === "advanced"),
        Debug: settingsMenu.filter((e) => e.cat === "debug"),
        Experimental: settingsMenu.filter((e) => e.cat === "experimental"),
    };

    function keyup(ev: KeyboardEvent) {
        switch (ev.code) {
            case "Escape":
                requestLock();
                break;
        }
    }
</script>

<svelte:window on:keyup|preventDefault={keyup} />

<div
    transition:fade
    class:hidden={$editor.active}
    class="absolute inset-0 opacity-50 bg-neutral pointer-events-none"
/>

<div class="absolute top-0 left-0 bottom-0 grid">
    <div transition:fly={{ x: "-100%" }} class="
        bg-honeycomb
        w-screen max-w-96 overflow-y-scroll overflow-x-hidden
        flex flex-col pb-80 gap-2
    "
    class:hidden={showTouchControls}>
        <div class="self-center pt-2"><a href="#{game.wad.name}"><Picture name="M_DOOM" /></a></div>
        <div class="px-2">
            <div class="flex gap-4 items-center pb-2">
                {#if $intermission}
                    <span>Intermission</span>
                {:else}
                    <span><MapNamePic name={$map.name} /></span>
                {/if}
                <span><Picture name={data.skills.find((sk) => sk.num === game.skill).pic}/></span>
            </div>
            <MapStats map={$map} />
        </div>
        <div class="divider" />
        <button class="btn btn-primary uppercase z-20 sticky top-0" on:click={requestLock}>Resume</button>
        <!-- TODO: someday... get save/load working-->
        <button class="btn" disabled>Load</button>
        <button class="btn" disabled>Save</button>

        <div class="divider" />
        <div class="dropdown md:static">
            <div tabindex="0" role="button" class="btn w-full">Settings</div>
            <div tabindex="-1" class="
                dropdown-content z-10 shadow bg-base-100 w-screen max-w-96 rounded-box
                overflow-y-scroll top-12 bottom-0
                pb-80 md:top-0 md:pb-10 md:left-96
            ">
                <ul class="menu">
                    {#each Object.entries(settings) as [category, values]}
                        <div class="divider sticky my-2 z-10 top-0 bg-base-100">{category}</div>
                        {#each values as item}
                            <li><MenuItem {item} /></li>
                        {/each}
                    {/each}

                    <div class="divider sticky my-2 z-10 top-0 bg-base-100">Other</div>
                    <li>
                        <label class="label cursor-pointer">
                            <span class="label-text">Inspector</span>
                            <input type="checkbox" class="checkbox" bind:checked={$editor.active} on:change={() => ($editor.selected = null)} />
                        </label>
                    </li>
                </ul>
            </div>
        </div>
        <div class="dropdown" on:focusin={() => showTouchControls = touchDevice}>
            <div tabindex="0" role="button" class="btn w-full">Controls</div>
            <div tabindex="-1" class="
                dropdown-content z-10 shadow bg-base-100 w-screen max-w-96 rounded-box
            ">
                {#if !showTouchControls}
                <KeyboardControlsMenu />
                {/if}
            </div>
        </div>
        {#if $map}
        <div class="dropdown">
            <div tabindex="0" role="button" class="btn w-full">Cheats</div>
            <div tabindex="-1" class="
                dropdown-content z-10 shadow bg-base-100 w-screen max-w-96 rounded-box
                flex flex-col gap-1
                pb-10
            ">
                <CheatsMenu player={$map.player} />
            </div>
        </div>
        {/if}

        <div class="flex items-center gap-4 text-xs px-2 absolute bottom-4">
            <!-- svelte-ignore missing-declaration -->
            <span>v{APP_VERSION}</span>
            <a class="link" href="https://github.com/lloydmarkle/iso-doom" target="_black" rel="noreferrer">github</a>
        </div>
    </div>
</div>

{#if showTouchControls}
<div
    class="absolute inset-0 z-30"
    transition:fly={{ y: '-100%' }}
>
    <div class="absolute inset-0 bg-honeycomb opacity-60 pointer-events-none" />
    <div class="relative w-full h-full">
        <TouchControlsMenu {viewSize} bind:visible={showTouchControls} />
    </div>
</div>
{/if}

<style>
    .dropdown .btn:focus {
        background: oklch(var(--b1));
    }
</style>