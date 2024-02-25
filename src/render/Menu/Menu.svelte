<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { useAppContext, useDoom } from "../DoomContext";
    import MenuItem from "./MenuItem.svelte";
    import MapNamePic from "../Components/MapNamePic.svelte";
    import Picture from "../Components/Picture.svelte";
    import { data } from "../../doom";
    import MapStats from "./MapStats.svelte";
    import CheatsMenu from "./CheatsMenu.svelte";

    export let requestLock: () => void;

    const { settingsMenu, editor } = useAppContext();
    const { game } = useDoom();
    const { intermission, map } = game;
    const alwaysRun = game.settings.alwaysRun;

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
        w-screen max-w-96 overflow-scroll
        flex flex-col pb-80 gap-2
    ">
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
        <button class="btn btn-primary uppercase" on:click={requestLock}>Resume</button>
        <!-- TODO: someday... get save/load working-->
        <button class="btn" disabled>Load</button>
        <button class="btn" disabled>Save</button>

        <div class="divider" />
        <div class="dropdown md:static">
            <div tabindex="0" role="button" class="btn w-full">Settings ❯</div>
            <div tabindex="-1" class="
                dropdown-content z-10 p-2 shadow bg-base-100 w-screen max-w-96 rounded-box
                overflow-y-scroll top-12 bottom-0
                pb-80 md:top-0 md:pb-10 md:left-96
            ">
                <ul class="menu">
                    {#each Object.entries(settings) as [category, values]}
                        <div class="divider">{category}</div>
                        {#each values as item}
                            <li><MenuItem {item} /></li>
                        {/each}
                    {/each}

                    <div class="divider">Other</div>
                    <li>
                        <label class="label cursor-pointer">
                            <span class="label-text">Inspector</span>
                            <input
                                type="checkbox"
                                class="checkbox"
                                bind:checked={$editor.active}
                                on:change={() => ($editor.selected = null)}
                            />
                        </label>
                    </li>
                </ul>
            </div>
        </div>
        <div class="dropdown">
            <div tabindex="0" role="button" class="btn w-full">Controls</div>
            <div tabindex="-1" class="
                dropdown-content z-10 p-2 shadow bg-base-100 w-screen max-w-96 rounded-box
                text-center text-xs
            ">
                Move: <kbd class="kbd">W</kbd><kbd class="kbd">A</kbd><kbd class="kbd">S</kbd><kbd class="kbd">D</kbd><br />
                Use: <kbd class="kbd">E</kbd><br />
                Shoot: Left-click<br />
                {$alwaysRun ? "Walk" : "Run"}:<kbd class="kbd">Shift</kbd><br />
                Weapons: <kbd class="kbd">1</kbd>-<kbd class="kbd">7</kbd><br />
            </div>
        </div>
        {#if $map}
        <div class="dropdown">
            <div tabindex="0" role="button" class="btn w-full">Cheats</div>
            <div tabindex="-1" class="
                dropdown-content z-10 p-2 shadow bg-base-100 w-screen max-w-96 rounded-box
                flex flex-col gap-1
                pb-10
            ">
                <CheatsMenu player={$map.player} />
            </div>
        </div>
        {/if}

        <div class="flex items-center gap-4 text-xs px-2">
            <!-- svelte-ignore missing-declaration -->
            <span>v{APP_VERSION}</span>
            <a class="link" href="https://github.com/lloydmarkle/iso-doom" target="_black" rel="noreferrer">github</a>
        </div>
    </div>
</div>

<style>
    .dropdown .btn:focus {
        background: oklch(var(--b1));
    }
</style>