<script lang="ts">
    import type { LineDef, MapRuntime } from "../../doom";
    import { useAppContext, useDoomMap } from "../DoomContext";
    import FlagList from "./FlagList.svelte";
    import NumberChooser from "./NumberChooser.svelte";
    import SidedefEditor from "./SidedefEditor.svelte";

    export let map: MapRuntime;
    export let linedef: LineDef;

    const { editor } = useAppContext();
    const { renderSectors } = useDoomMap();
    // https://doomwiki.org/wiki/Linedef
    const flagInfo: [number, string][] = [
        [0x0001, 'blocks players and monsters'],
        [0x0002, 'blocks monsters'],
        [0x0004, 'two sided'],
        [0x0008, 'upper texture is unpegged'],
        [0x0010, 'lower texture is unpegged'],
        [0x0020, 'secret (shows as one-sided on automap), and monsters cannot open if it is a door (type 1)'],
        [0x0040, 'blocks sound'],
        [0x0080, 'never shows on automap'],
        [0x0100, 'always shows on automap '],
    ];

    function tagSector() {
        $editor.selected = renderSectors.find(e => e.sector.tag === linedef.tag);
    }

    function changeLinedef(ev) {
        const linedef = map.data.linedefs.find(e => e.num === ev.detail)
        if (linedef) {
            $editor.selected = linedef
        }
    }
</script>

<h3>Linedef <NumberChooser num={linedef.num} on:select={changeLinedef} /></h3>
<div>
    <FlagList info={flagInfo} bind:flags={linedef.flags} />
</div>
<div>
    Special {linedef.special}
    {#if linedef.special}
        <button class="btn" on:click={tagSector}>Tag: {linedef.tag}</button>
    {/if}
</div>
<div>
    {#if linedef.left}
        <h4>Right sidedef</h4>
    {/if}
    <SidedefEditor {map} sidedef={linedef.right} />
</div>
{#if linedef.left}
    <div>
        <h4>Left sidedef</h4>
        <SidedefEditor {map} sidedef={linedef.left} />
    </div>
{/if}

<style>
    h4 {
        border-top: 2px solid grey;
    }
</style>