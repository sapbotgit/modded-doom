<script lang="ts">
    import { T, useThrelte } from '@threlte/core';
    import { MeshBasicMaterial } from 'three';
    import { useDoomMap } from '../DoomContext';
    import { TextureAtlas } from './TextureAtlas'
    import { MapRenderGeometryBuilder } from './GeometryBuilder';
    import Wireframe from '../Debug/Wireframe.svelte';
    import { mapMeshMaterials } from './MapMeshMaterial';


    const threlte = useThrelte();

    const { renderSectors, map } = useDoomMap();
    const ta = new TextureAtlas(map.game.wad, threlte.renderer.capabilities.maxTextureSize);
    const mapBuilder = new MapRenderGeometryBuilder(ta);
    for (const rs of renderSectors) {
        rs.linedefs.forEach(ld => mapBuilder.addLinedef(ld));
        if (!rs.geometry) {
            // Plutonia MAP29?
            continue;
        }
        // TODO: what about hack floor/ceiling? That whole thing is buggy and needs a rewrite anyway
        mapBuilder.addFlat(rs, rs.sector.floorFlat.val, rs.sector.zFloor.val);
        mapBuilder.addFlat(rs, rs.sector.ceilFlat.val, rs.sector.skyHeight ?? rs.sector.zCeil.val, true);
    }

    const mapGeo = mapBuilder.build();
    const geometry = mapGeo.geometry;

    const { material, distanceMaterial, depthMaterial } = mapMeshMaterials(ta, mapGeo);
    const skyMaterial = new MeshBasicMaterial({ depthWrite: true, colorWrite: false });

    // magic https://stackoverflow.com/questions/49873459
    const shadowBias = -0.004;

    const receiveShadow = true;
    const castShadow = receiveShadow;
    const { position } = map.player;
</script>

<T.Mesh
    renderOrder={0}
    geometry={mapGeo.skyGeometry}
    material={skyMaterial}
>
    <Wireframe />
</T.Mesh>

<T.Mesh
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

<T.PointLight
    {castShadow}
    color={0xff0000}
    intensity={50}
    distance={400}
    decay={0.2}
    position.x={$position.x}
    position.y={$position.y}
    position.z={$position.z + 40}
    shadow.bias={shadowBias}
/>
