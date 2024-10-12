<script lang="ts">
    import { T, useThrelte } from '@threlte/core';
    import { ShaderMaterial } from 'three';
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
        // TODO: what abaut hack floor/ceiling?
        mapBuilder.addFlat(rs, rs.sector.floorFlat.val, rs.sector.zFloor.val);
        mapBuilder.addFlat(rs, rs.sector.ceilFlat.val, rs.sector.zCeil.val, true);
    }

    const mapGeo = mapBuilder.build();
    const geometry = mapGeo.geometry;

    const material = new ShaderMaterial({ ...TextureAtlasShader() });
    material.uniforms.tLightMap.value = mapGeo.lightMap;
    material.uniforms.numSectors.value = mapGeo.lightMap.image.width;
    material.uniforms.tMap.value = ta.texture;
    material.uniforms.tAtlas.value = ta.atlas;
</script>

<T.Mesh
    {geometry}
    {material}
>
    <Wireframe />
</T.Mesh>
