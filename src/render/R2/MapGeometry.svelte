<script lang="ts">
    import { T, useThrelte } from '@threlte/core';
    import { MeshBasicMaterial } from 'three';
    import { useAppContext, useDoomMap } from '../DoomContext';
    import { TextureAtlas } from './TextureAtlas'
    import { buildLightMap, buildMapGeometry } from './GeometryBuilder';
    import Wireframe from '../Debug/Wireframe.svelte';
    import { mapMeshMaterials } from './MapMeshMaterial';
    import { onDestroy } from 'svelte';

    const threlte = useThrelte();

    const { editor, settings } = useAppContext();
    const { fakeContrast, playerLight } = settings;
    const { renderSectors, map } = useDoomMap();

    console.time('map-geo')
    const ta = new TextureAtlas(map.game.wad, threlte.renderer.capabilities.maxTextureSize);
    const { geometry, skyGeometry, dispose } = buildMapGeometry(ta, renderSectors);
    onDestroy(() => dispose());
    console.timeEnd('map-geo')

    const { lightMap, lightLevels } = buildLightMap(map.data.sectors);
    const { material, distanceMaterial, depthMaterial, uniforms } = mapMeshMaterials(ta, lightMap, lightLevels);
    const skyMaterial = new MeshBasicMaterial({ depthWrite: true, colorWrite: false });

    // magic https://stackoverflow.com/questions/49873459
    const shadowBias = -0.004;

    $: usePlayerLight = $playerLight !== '#000000';
    $: receiveShadow = usePlayerLight;
    $: castShadow = receiveShadow;
    const { position, extraLight } = map.player;

    function hit(ev) {
        ev.stopPropagation();

        const type = geometry.attributes.doomInspect.array[ev.face.a * 2];
        const items = type === 0 ? map.data.linedefs : map.data.sectors;
        const num = geometry.attributes.doomInspect.array[ev.face.a * 2 + 1];
        $editor.selected = items.find(e => e.num === num);
    }
    $: $uniforms.doomFakeContrast.value =
        $fakeContrast === 'off' ? 0 :
        $fakeContrast === 'classic' ? 1 :
        2;
    $: $uniforms.doomExtraLight.value = $extraLight / 256;
    $: ((edit) => {
        $uniforms.dInspect.value = edit.selected
            ? [
                'special' in edit.selected ? 0 : 1,
                edit.selected.num,
            ]
            // clear selection
            : [-1, -1];
    })($editor);
</script>

<T.Mesh
    renderOrder={0}
    geometry={skyGeometry}
    material={skyMaterial}
>
    <Wireframe />
</T.Mesh>

<T.Mesh
    on:click={hit}
    renderOrder={1}
    {geometry}
    {material}
    customDepthMaterial={depthMaterial}
    customDistanceMaterial={distanceMaterial}
    {receiveShadow}
    {castShadow}
>
    <Wireframe />
</T.Mesh>

{#if usePlayerLight}
    <T.PointLight
        {castShadow}
        color={$playerLight}
        intensity={10}
        distance={400}
        decay={0.2}
        position.x={$position.x}
        position.y={$position.y}
        position.z={$position.z + 40}
        shadow.bias={shadowBias}
    />
{/if}