<script lang="ts">
    import type { DoomMap, LineDef } from "../../doomwad";
    import SidedefEditor from "./SidedefEditor.svelte";

    export let map: DoomMap;
    export let linedef: LineDef;
</script>

<h3>Linedef</h3>
<div>
    <span>{linedef.left ? 'Right' : 'Main'}</span>
    <SidedefEditor {map} sidedef={linedef.right} />
</div>
{#if linedef.left}
    <div>
        <span>Left</span>
        <SidedefEditor {map} sidedef={linedef.left} />
    </div>
{/if}
