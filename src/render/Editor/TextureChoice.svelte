<script lang="ts">
    import Picture from "../Components/Picture.svelte";

    export let name: string;
    export let type: 'wall' | 'flat';
</script>

<div>{name}</div>
<Picture {name} {type} />