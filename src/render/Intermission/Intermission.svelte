<script lang="ts">
    import type { Size } from "@threlte/core";
    import { useDoom } from "../DoomContext";
    import MusicPlayer from "../MusicPlayer.svelte";
    import SoundPlayer from "../SoundPlayer.svelte";
    import VictoryArt from "./VictoryArt.svelte";
    import VictoryCast from "./VictoryCast.svelte";
    import VictoryText from "./VictoryText.svelte";
    import Summary from "./Summary.svelte";
    import { MapRuntime, type IntermissionScreen } from "../../doom";

    export let details: IntermissionScreen;
    export let musicGain: GainNode;
    export let soundGain: GainNode;
    export let size: Size;

    $: scale = Math.min(size.width / 320, size.height / 200);
    const { game } = useDoom();

    const mapName = details.finishedMap.name;
    let episodeEnd = mapName.endsWith('M8')
    let summaryComplete = episodeEnd;
    let textComplete = false;
    let artComplete = !episodeEnd;
    let castComplete = mapName !== 'MAP30';
    $: if (artComplete && textComplete && summaryComplete && castComplete && !episodeEnd) {
        const nextMap = new MapRuntime(details.nextMapName, game);
        game.map.set(nextMap);
        game.intermission.set(null);
    }

    $: musicTrack =
        !summaryComplete ? (game.episodic ? 'D_INTER' : 'D_DM2INT') :
        mapName === 'E3M8' && textComplete ? 'D_BUNNY' :
        mapName === 'MAP30' && textComplete ? 'D_EVIL' :
        mapName[0] === 'E' ? 'D_VICTOR' : 'D_READ_M';
</script>

<MusicPlayer {game} audioRoot={musicGain} trackName={musicTrack} />
<SoundPlayer {game} audioRoot={soundGain} />

<div
    class="
    absolute inset-0
    flex justify-center items-center
    "
    style="transform:scale({scale});"
>
    {#if !summaryComplete}
        <Summary {details} bind:complete={summaryComplete}/>
    {:else if !textComplete}
        <VictoryText {mapName} bind:complete={textComplete} />
    {:else if !artComplete}
        <VictoryArt {mapName} bind:complete={artComplete} />
    {:else if mapName === 'MAP30'}
        <VictoryCast />
    {/if}
</div>
