<script lang="ts">
    import { T, useTask, useThrelte } from '@threlte/core';
    import { BufferAttribute, DoubleSide, BufferGeometry, Mesh, Color, MeshDepthMaterial, RGBADepthPacking, Material, PlaneGeometry, MeshDistanceMaterial, PCFSoftShadowMap, PCFShadowMap, ShaderMaterial, VSMShadowMap,BasicShadowMap, SphereGeometry, MeshBasicMaterial } from 'three';
    import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
    import { DoomWad, HALF_PI, store, WadFile } from '../../doom';
    import { WadStore } from '../../WadStore';
    import { TextureAtlas } from '../R2/TextureAtlas';
    import { MapRenderGeometryBuilder } from '../R2/GeometryBuilder';
    import type { RenderSector } from '../RenderData';
    import { mapMeshMaterials } from '../R2/MapMeshMaterial';
    import { onMount } from 'svelte';

    let geometry: BufferGeometry;
    let material: Material;
    let depthMaterial: Material;
    let distanceMaterial: Material;

    const threlte = useThrelte();

    const stressTest = false;
    const animate = false;
    const wallSize = 300;

    const wadStore = new WadStore();
    async function init() {
        const wadNames = ['doom']
        const wadResolvers = wadNames.map(name => wadStore.fetchWad(name).then(buff => new WadFile(name, buff)));
        const wads = await Promise.all(wadResolvers);
        const wad = new DoomWad(wadNames.join('+'), wads);

        const ta = new TextureAtlas(wad, threlte.renderer.capabilities.maxTextureSize / 2);
        const mrgBuilder = new MapRenderGeometryBuilder(ta);
        const textureNames = wad.texturesNames();
        let geo: BufferGeometry;

        const source = { sector: { num : 0, light: store(255) } } as RenderSector;
        if (stressTest) {
            let size = 400_000;
            for (let i = 0; i < size; i++) {
                geo = new PlaneGeometry(Math.random() * wallSize + wallSize / 2, Math.random() * wallSize + wallSize / 2);
                mrgBuilder.addGeometry(geo, source);
                mrgBuilder.applyWallTexture(geo, textureNames[i % textureNames.length], 0)

                if (Math.random() < .2) {
                    geo.rotateX(HALF_PI);
                }
                if (Math.random() < .4) {
                    geo.rotateX(-HALF_PI);
                }
                if (Math.random() < .6) {
                    geo.rotateY(HALF_PI);
                }
                if (Math.random() < .8) {
                    geo.rotateY(-HALF_PI);
                }

                geo.translate(
                    wallSize * Math.random() * 100,
                    wallSize * Math.random() * 100,
                    wallSize * Math.random() * 100,
                );
            }
        }

        // ceil
        geo = new PlaneGeometry(wallSize, wallSize);
        mrgBuilder.addGeometry(geo, source);
        geo.attributes.uv.array.set(geo.attributes.uv.array.map(e => e * 64));
        mrgBuilder.applyFlatTexture(geo, "CEIL4_2", 0);
        geo.rotateX(HALF_PI);
        geo.translate(0, wallSize, 0);

        // floor
        geo = new PlaneGeometry(wallSize, wallSize);
        mrgBuilder.addGeometry(geo, source);
        mrgBuilder.applyFlatTexture(geo, "STEP1", 0);
        geo.rotateX(-HALF_PI);

        // left
        geo = new PlaneGeometry(wallSize, wallSize);
        mrgBuilder.addGeometry(geo, source);
        mrgBuilder.applyWallTexture(geo, textureNames[1], 0);
        geo.rotateY(HALF_PI);
        geo.translate(-wallSize / 2, wallSize / 2, 0);

        // right
        geo = new PlaneGeometry(wallSize, wallSize);
        mrgBuilder.addGeometry(geo, source);
        mrgBuilder.applyWallTexture(geo, textureNames[2], 0);
        geo.rotateY(-HALF_PI);
        geo.translate(wallSize / 2, wallSize / 2, 0);

        // back
        geo = new PlaneGeometry(wallSize, wallSize);
        let backWall = mrgBuilder.addGeometry(geo, source);
        mrgBuilder.applyWallTexture(geo, textureNames[14], 0);
        geo.translate(0, wallSize / 2, -wallSize / 2);

        // mid front
        geo = new PlaneGeometry(300, 196);
        mrgBuilder.addGeometry(geo, source);
        mrgBuilder.applyWallTexture(geo, 'BRNSMALC', 0);
        geo.translate(0, 100, 0);
        // mid back
        geo = new PlaneGeometry(300, 196);
        mrgBuilder.addGeometry(geo, source);
        mrgBuilder.applyWallTexture(geo, 'BRNSMALC', 0);
        geo.rotateX(Math.PI);
        geo.translate(0, 100, 0);

        const mapGeo = mrgBuilder.build();
        geometry = mapGeo.geometry;

        let m = mapMeshMaterials(ta, mapGeo);
        material = m.material;
        depthMaterial = m.depthMaterial;
        distanceMaterial = m.distanceMaterial;

        if (animate) {
            let n = 0;
            setInterval(() => {
                for (let i = 0; i < (stressTest ? 100 : 1); i++) {
                    n = (n + 1) % textureNames.length;
                    let gi = stressTest ? Math.floor(Math.random() * mapGeo.geoInfo.length - 1) : backWall;
                    mapGeo.changeWallHeight(gi, wallSize * Math.random() * 2, textureNames[n]);
                }
            }, stressTest ? 1 : 1000)
        }
    }
    const loaded = init();
</script>


{#await loaded}
    Loading
{:then}
    <T.Mesh
        castShadow
        receiveShadow
        position.y={-wallSize / 2}
        {geometry}
        {material}
        customDepthMaterial={depthMaterial}
        customDistanceMaterial={distanceMaterial}
    />
{/await}


<T.PointLight
    color={0xe7e7e7}
    intensity={20}
    distance={400}
    decay={0}
    castShadow
    position.y={-70}
    position.z={180}
    shadow.bias={-.004}
>
    <T.Mesh geometry={new SphereGeometry(10)} material={new MeshBasicMaterial({ color: 'white' })} />
</T.PointLight>
