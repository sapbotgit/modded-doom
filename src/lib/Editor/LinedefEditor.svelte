<script lang="ts">
    import type { DoomMap, LineDef } from "../../doom";
    import SidedefEditor from "./SidedefEditor.svelte";

    export let map: DoomMap;
    export let linedef: LineDef;
</script>

<h3>Linedef</h3>
<div>
    flags {linedef.flags}
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