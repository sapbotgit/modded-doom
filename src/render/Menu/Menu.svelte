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
    class="absolute inset-0 flex justify-center items-center opacity-50 bg-neutral pointer-events-none"
/>

<div class="absolute inset-0 grid grid-rows-[minmax(0,1fr)_max-content]">
    <div
        class="
        honeycomb
        w-96 flex flex-col pt-4 pb-80 gap-4 overflow-scroll
        "
        transition:fly={{ x: "-24em" }}
    >
        <div class="self-center"><a href="#{game.wad.name}"><Picture name="M_DOOM" /></a></div>
        <div class="md:hidden divider" />
        <div class="md:hidden px-4">
            <div class="flex gap-4 items-center">
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
        <!-- TODO: someday... get save/load working-->
        <button class="btn" disabled>Load</button>
        <button class="btn" disabled>Save</button>
        <div class="divider" />
        <details class="dropdown md:static">
            <summary class="btn w-full">Settings ❯</summary>
            <div
                class="
                    dropdown-content z-10 p-2 shadow bg-base-100 w-96 rounded-box
                    overflow-y-scroll bottom-0
                    top-[3em] md:top-0 md:left-96 pb-80
                "
            >
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
        </details>
        <details class="dropdown md:static">
            <summary class="btn w-full">Controls</summary>
            <div class="
                dropdown-content z-10 p-2 shadow bg-base-100 w-96 rounded-box text-center
                top-[3em] md:top-[34em] md:left-96 text-xs
            ">
                Move: <kbd class="kbd">W</kbd><kbd class="kbd">A</kbd><kbd class="kbd">S</kbd><kbd class="kbd">D</kbd><br />
                Use: <kbd class="kbd">E</kbd><br />
                Shoot: Left-click<br />
                {$alwaysRun ? "Walk" : "Run"}:<kbd class="kbd">Shift</kbd><br />
                Weapons: <kbd class="kbd">1</kbd>-<kbd class="kbd">7</kbd><br />
            </div>
        </details>
        {#if $map}
        <details class="dropdown md:static">
            <summary class="btn w-full">Cheats</summary>
            <div class="
                dropdown-content z-10 p-2 shadow bg-base-100 w-96 rounded-box
                flex flex-col gap-1
                top-[3em] md:top-[29em] md:left-96 pb-40
            ">
                <CheatsMenu player={$map.player} />
            </div>
        </details>
        {/if}
    </div>

    <div
        class="flex gap-4 items-center justify-between honeycomb z-10"
        transition:fly={{ y: "2em" }}
    >
        <div class="flex flex-col gap-4">
            <button class="btn btn-primary w-96 uppercase" on:click={requestLock}>Play</button>
            <div class="flex items-center gap-4 text-xs pe-4">
                <span>v{APP_VERSION}</span>
                <a class="link" href="https://github.com/lloydmarkle/iso-doom" target="_black" rel="noreferrer">github</a>
            </div>
        </div>

        <div class="hidden md:flex flex-col gap-4 items-center">
            {#if $intermission}
                <span>Intermission</span>
            {:else}
                <span><MapNamePic name={$map.name} /></span>
            {/if}
            <span><Picture name={data.skills.find(sk => sk.num === game.skill).pic} /></span>
        </div>

        <div class="hidden md:flex">
            <MapStats map={$map} />
        </div>
    </div>
</div>
