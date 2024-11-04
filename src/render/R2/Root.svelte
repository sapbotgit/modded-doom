<script lang="ts">
    import { type MapRuntime } from "../../doom";
    import { useAppContext } from "../DoomContext";
    import Stats from "../Debug/Stats.svelte";
    import SkyBox from "../Map/SkyBox.svelte";
    import Player from "../Map/Player.svelte";
    import MapGeometry from "./MapGeometry.svelte";
    import { interactivity } from "@threlte/extras";
    import EditorTagLink from "../Editor/EditorTagLink.svelte";
    import Sprites from './Sprite/Sprites.svelte';

    export let map: MapRuntime;

    const { editor } = useAppContext();
    const interact = interactivity({ enabled: $editor.active });
    $: interact.enabled.set($editor.active);
</script>

<Stats />

<SkyBox />

<MapGeometry {map} />

<Sprites {map} />

<Player />

<EditorTagLink {map} />
