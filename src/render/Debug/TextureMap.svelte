<script lang="ts">
    import { T, useTask, useThrelte } from '@threlte/core';
    import { Vector3, BufferGeometry, Material, PlaneGeometry, SphereGeometry, MeshBasicMaterial, Fog } from 'three';
    import { DoomWad, HALF_PI, store, WadFile } from '../../doom';
    import { WadStore } from '../../WadStore';
    import { MapTextureAtlas, TextureAtlas } from '../R2/TextureAtlas';
    import { inspectorAttributeName, mapMeshMaterials } from '../R2/MapMeshMaterial';
    import { geometryBuilder, int16BufferFrom, mapGeometry } from '../R2/GeometryBuilder';
    import { buildLightMap } from '../R2/MapLighting';

    let geometry: BufferGeometry;
    let material: Material;
    let depthMaterial: Material;
    let distanceMaterial: Material;
    let ta: MapTextureAtlas;

    const threlte = useThrelte();

    type TestGeom = { id: number, width: number, height: number };
    let stressTestSize = 400_000;
    // stressTestSize = 1000;
    const animate = true;
    const wallSize = 300;
    const atlasSize = threlte.renderer.capabilities.maxTextureSize / 2;

    const wadStore = new WadStore();
    async function init() {
        const wadNames = ['doom']
        const wadResolvers = wadNames.map(name => wadStore.fetchWad(name).then(buff => new WadFile(name, buff)));
        const wads = await Promise.all(wadResolvers);
        const wad = new DoomWad(wadNames.join('+'), wads);

        ta = new MapTextureAtlas(wad, new TextureAtlas(atlasSize));
        // TODO: can we split DOOM stuff (linedef/sector) out of mapGeometryBuilder and just get a geometry builder that
        // is _used by_ MGB?
        const geoBuilder = geometryBuilder();
        const textureNames = wad.texturesNames();
        let geo: BufferGeometry;

        let stressGeos: TestGeom[] = [];
        const scatter = Math.max(wallSize * 5, stressTestSize / 10);
        for (let i = 0; i < stressTestSize; i++) {
            const width = Math.random() * wallSize + wallSize * .5;
            const height = Math.random() * wallSize + wallSize * .5;
            geo = new PlaneGeometry(width, height);
            let dirChoice = Math.random();
            let angle =
                dirChoice < .25 ? 0 :
                dirChoice < .5 ? HALF_PI :
                dirChoice < .75 ? Math.PI :
                -HALF_PI;
            geo = geoBuilder.createWallGeo(
                Math.random() * wallSize + wallSize * .5,
                Math.random() * wallSize + wallSize * .5,
                { x: scatter * Math.random() + wallSize, y: scatter * Math.random() + wallSize }, scatter * Math.random() + wallSize,
                angle);
            const id = geoBuilder.addWallGeometry(geo, 0);
            stressGeos.push({ id, width, height });
        }

        let box = {
            ceil: null as TestGeom,
            floor: null as TestGeom,
            left: null as TestGeom,
            right: null as TestGeom,
            back: null as TestGeom,
            midF: null as TestGeom,
            midB: null as TestGeom,
        };

        // ceil
        geo = new PlaneGeometry(wallSize, wallSize);
        geo = geoBuilder.createFlatGeo(geo, "CEIL4_2");
        geo.translate(0, wallSize / 2, -2 * wallSize / 3);
        box.ceil = { id: geoBuilder.addFlatGeometry(geo, 0), width: wallSize, height: wallSize };
        // floor
        geo = new PlaneGeometry(wallSize, wallSize);
        geo.rotateX(Math.PI);
        geo = geoBuilder.createFlatGeo(geo, "STEP1");
        geo.translate(0, wallSize / 2, wallSize / 3);
        box.floor = { id: geoBuilder.addFlatGeometry(geo, 0), width: wallSize, height: wallSize };

        // left
        geo = geoBuilder.createWallGeo(wallSize, wallSize, { x: -wallSize / 2, y: wallSize / 2 }, wallSize / 3, HALF_PI);
        box.left = ({ id: geoBuilder.addWallGeometry(geo, 0), width: wallSize, height: wallSize });
        geo = new PlaneGeometry(wallSize, wallSize);
        // right
        geo = geoBuilder.createWallGeo(wallSize, wallSize, { x: wallSize / 2, y: wallSize / 2 }, wallSize / 3, -HALF_PI);
        box.right = ({ id: geoBuilder.addWallGeometry(geo, 0), width: wallSize, height: wallSize });
        // back
        geo = geoBuilder.createWallGeo(wallSize, wallSize, { x: 0, y: wallSize }, wallSize / 3, 0);
        box.back = ({ id: geoBuilder.addWallGeometry(geo, 0), width: wallSize, height: wallSize });
        // mid
        geo = geoBuilder.createWallGeo(300, 128, { x: 0, y: 200 }, 0, 0);
        box.midF = ({ id: geoBuilder.addWallGeometry(geo, 0), width: 300, height: 128 });
        geo = geoBuilder.createWallGeo(300, 128, { x: 0, y: 200 }, 0, Math.PI);
        box.midB = ({ id: geoBuilder.addWallGeometry(geo, 0), width: 300, height: 128 });

        // texture atlas wall
        geo = geoBuilder.createWallGeo(atlasSize * .2, atlasSize * .2, { x: 0, y: 200 }, 0, Math.PI);

        const map = geoBuilder.build();
        const mapGeo = mapGeometry(ta, map.geometry, map.skyGeometry, map.geoInfo);
        mapGeo.geometry.setAttribute(inspectorAttributeName, int16BufferFrom([0, 0], mapGeo.geometry.attributes.position.count));
        geometry = mapGeo.geometry;

        mapGeo.applyFlatTexture(box.ceil.id, "CEIL3_2");
        mapGeo.applyFlatTexture(box.floor.id, "STEP1");
        mapGeo.applyWallTexture(box.left.id, textureNames[1], box.left.width, box.left.height, 0, 0)
        mapGeo.applyWallTexture(box.right.id, textureNames[2], box.right.width, box.right.height, 0, 0)
        mapGeo.applyWallTexture(box.back.id, textureNames[14], box.back.width, box.back.height, 0, 0)
        mapGeo.applyWallTexture(box.midF.id, 'BRNSMALC', box.midF.width, box.midF.height, 0, 0);
        mapGeo.applyWallTexture(box.midB.id, 'BRNSMALC', box.midB.width, box.midB.height, 0, 0);

        for (let i = 0; i < stressGeos.length; i++) {
            mapGeo.applyWallTexture(stressGeos[i].id,
                textureNames[i % textureNames.length],
                stressGeos[i].width, stressGeos[i].height,
                0, 0);
        }

        ta.commit();
        const lighting = buildLightMap([{ light: store(255) } as any]);
        let m = mapMeshMaterials(ta, lighting);
        material = m.material;
        depthMaterial = m.depthMaterial;
        distanceMaterial = m.distanceMaterial;

        // if (animate) {
        //     let n = 0;
        //     setInterval(() => {
        //         for (let i = 0; i < (stressTest ? 100 : 1); i++) {
        //             n = (n + 1) % textureNames.length;
        //             let gi = stressTest ? Math.floor(Math.random() * mapGeo.geoInfo.length - 1) : backWall;
        //             mapGeo.changeWallHeight(gi, wallSize * Math.random() * 2, textureNames[n]);
        //         }
        //     }, stressTest ? 1 : 1000)
        // }
    }
    const loaded = init();

    let lightPos = new Vector3(0, -70, -40);
    if (animate) {
        useTask(() => {
            lightPos.x = Math.sin(new Date().getTime() / Math.PI * 2 / 200) * 30;
        });
    }
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

    <T.Mesh
        geometry={new PlaneGeometry(atlasSize * .2, atlasSize * .2)}
        material={new MeshBasicMaterial({ map: ta.texture, alphaTest: .5 })}
        scale.x={-1}
        position.y={-atlasSize * .5}
        rotation.x={HALF_PI}
        rotation.z={Math.PI}
    />
{/await}

<T.PointLight
    color={0xe7e7e7}
    intensity={20}
    distance={300}
    decay={0}
    castShadow
    position.x={lightPos.x}
    position.y={lightPos.y}
    position.z={lightPos.z}
    shadow.bias={-.004}
>
    <T.Mesh geometry={new SphereGeometry(10)} material={new MeshBasicMaterial({ color: 'white' })} />
</T.PointLight>


<T.Scene
    fog={new Fog(0xcc0000, 1, 15_000)}
/>