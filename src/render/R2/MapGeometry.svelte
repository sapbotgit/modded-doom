<script lang="ts">
    import { T, useThrelte } from '@threlte/core';
    import { ShaderMaterial, MeshBasicMaterial } from 'three';
    import { useDoomMap } from '../DoomContext';
    import { TextureAtlasShader } from '../Shaders/TextureAtlasShader';
    import { TextureAtlas } from './TextureAtlas'
    import { MapRenderGeometryBuilder } from './GeometryBuilder';
    import Wireframe from '../Debug/Wireframe.svelte';


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

    const material = new ShaderMaterial({ ...TextureAtlasShader() });
    material.uniforms.tLightMap.value = mapGeo.lightMap;
    material.uniforms.numSectors.value = mapGeo.lightMap.image.width;
    material.uniforms.tMap.value = ta.texture;
    material.uniforms.tAtlas.value = ta.atlas;
    material.uniforms.numTextures.value = ta.numTextures;

    const skyMaterial = new MeshBasicMaterial({ depthWrite: true, colorWrite: false });
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
>
    <Wireframe />
</T.Mesh>
