<script lang="ts">
    import Picture from "./Picture.svelte";

    export let name: string;

    $: episodeMaps = !name.startsWith('MAP');
    $: episode = parseInt(name[1])
    const mapNum = (mapName: string) => parseInt(mapName.substring(3, 5)) - 1;
    const mapImageName = (mapName: string) =>
        episodeMaps
            ? `WILV${episode - 1}${mapNum(mapName)}`
            : 'CWILV' + String(mapNum(mapName)).padStart(2, '0');
</script>

<Picture name={mapImageName(name)} />
