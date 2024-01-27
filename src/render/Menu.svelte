<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { useAppContext, useDoom } from "./DoomContext";
    import MenuItem from "./MenuItem.svelte";
    import MapNamePic from "./Components/MapNamePic.svelte";
    import Picture from "./Components/Picture.svelte";
    import { PlayerMapObject, data } from "../doom";

    export let player: PlayerMapObject;
    export let requestLock: () => void;

    const { settingsMenu, editor } = useAppContext();
    const { game } = useDoom();
    const { intermission, map } = game;

    const settings = {
        Normal: settingsMenu.filter((e) => e.cat === "normal"),
        Advanced: settingsMenu.filter((e) => e.cat === "advanced"),
        Debug: settingsMenu.filter((e) => e.cat === "debug"),
        Experimental: settingsMenu.filter((e) => e.cat === "experimental"),
    };
</script>

<div
    transition:fade
    class="absolute inset-x-0 inset-y-0 opacity-50 bg-neutral pointer-events-none"
    class:hidden={$editor.active}
/>

<div
    class="
        bg-base-100 absolute top-0 left-0 honeycomb
        flex flex-col pt-4 gap-4 h-screen
    "
    transition:fly={{ x: '-24em' }}
>
    <div class="self-center"><Picture name="M_DOOM" /></div>
    <div class="divider"/>
    <!-- TODO: someday... get save/load working-->
    <button class="btn" disabled>Load</button>
    <button class="btn" disabled>Save</button>
    <div class="divider"/>
    <div class="flex-none dropdown static w-96">
        <button class="btn w-full">Settings ❯</button>
        <div class="menu dropdown-content z-[1] p-2 shadow bg-base-100 top-0 left-96 w-full max-h-screen rounded-box overflow-y-scroll">
            <ul>
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
</div>

<div
    class="settings bg-base-100 shadow-xl honeycomb"
    transition:fly={{ x: -200 }}
>
    {#each Object.entries(settings) as [category, values]}
        <div class="divider">{category}</div>
        {#each values as item}
            <MenuItem {item} />
        {/each}
    {/each}

    <div class="divider">Other</div>
    <label class="label cursor-pointer">
        <span class="label-text">Inspector</span>
        <input
            type="checkbox"
            class="checkbox"
            bind:checked={$editor.active}
            on:change={() => ($editor.selected = null)}
        />
    </label>
</div>

<div
    class="
        rounded-box
        clip-trapezoid bg-base-100 mx-auto honeycomb
        absolute left-1/2 -translate-x-1/2
        px-36 p-4 top-0
        flex flex-col justify-center items-center gap-4
        border-2 border-accent
        "
        transition:fly={{ y: 200 }}
    >
    <!-- <Picture name="M_PAUSE" /> -->
    <div class="flex gap-4 items-center" class:hidden={$editor.active}>
        {#if $intermission}
            <span>Intermission</span>
        {:else}
            <span><MapNamePic name={$map.name} /></span>
        {/if}
        <span><Picture name={data.skills.find(sk => sk.num === game.skill).pic} /></span>
    </div>
    {#if $map}
    <div class="grid grid-cols-2 items-center text-sm" class:hidden={$editor.active}>
        <span class:text-primary={player.stats.kills >= $map.stats.totalKills}>Kills [{player.stats.kills} / {$map.stats.totalKills}]</span>
        <progress class="progress" max="1" value={player.stats.kills / $map.stats.totalKills}
            class:progress-primary={player.stats.kills >= $map.stats.totalKills} />

        <span class:text-primary={player.stats.items >= $map.stats.totalItems}>Items [{player.stats.items} / {$map.stats.totalItems}]</span>
        <progress class="progress" max="1" value={player.stats.items / $map.stats.totalItems}
            class:progress-primary={player.stats.items >= $map.stats.totalItems} />

        <span class:text-primary={player.stats.secrets >= $map.stats.totalSecrets}>Secrets [{player.stats.secrets} / {$map.stats.totalSecrets}]</span>
        <progress class="progress" max="1" value={player.stats.secrets / $map.stats.totalSecrets}
            class:progress-primary={player.stats.secrets >= $map.stats.totalSecrets} />
    </div>
    {/if}
    <button class="btn btn-wide btn-lg uppercase" on:click={requestLock}>Play</button>
    <!-- <span class="text-xs" class:hidden={$editor.active}>
        Move: <kbd class="kbd">W</kbd><kbd class="kbd">A</kbd><kbd class="kbd">S</kbd><kbd class="kbd">D</kbd><br>
        Use: <kbd class="kbd">E</kbd>; Weapons: <kbd class="kbd">1</kbd>-<kbd class="kbd">7</kbd><br>
        Shoot: Left-click<br>
        Run: <kbd class="kbd">Shift</kbd>
</span> -->
</div>

<style>
    .settings {
        position: absolute;
        left: 0;
        top: 0;

        text-align: left;
        padding: 1em;
        font-size: 0.9em;
        gap: 0.5em;
        display: flex;
        flex-direction: column;
        overflow-y: scroll;
        min-width: 20em;
        max-height: 100vh;
        display: none;
    }

    .clip-trapezoid {
        /* clip-path: polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%); */
    }
</style>
