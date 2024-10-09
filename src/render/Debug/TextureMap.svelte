<script lang="ts">
    import { Canvas, T } from '@threlte/core';
    import { BufferGeometry, DataTexture, DoubleSide, Material, MeshBasicMaterial, MeshStandardMaterial, NearestFilter, PerspectiveCamera, PlaneGeometry, RepeatWrapping, SRGBColorSpace } from 'three';
    import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
    import { DoomWad, HALF_PI, WadFile } from '../../doom';
    import { OrbitControls } from '@threlte/extras';
    import Stats from './Stats.svelte';
    import { WadStore } from '../../WadStore';

    let geometry: BufferGeometry;
    let material: Material;

    const wadStore = new WadStore();
    async function init() {
        const wadNames = ['doom']
        const wadResolvers = wadNames.map(name => wadStore.fetchWad(name).then(buff => new WadFile(name, buff)));
        const wads = await Promise.all(wadResolvers);
        const wad = new DoomWad(wadNames.join('+'), wads);

        // const data = wad.flatTextureData('CEIL3_5')
        // const data = wad.flatTextureData('FLOOR4_8')
        const data = wad.wallTextureData('BIGDOOR2')
        const buffer = new Uint8ClampedArray(data.width * data.height * 4);
        data.toAtlasBuffer(buffer, data.width, 0, 0);
        const texture = new DataTexture(buffer, data.width, data.height)
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.magFilter = NearestFilter;
        texture.flipY = true;
        texture.needsUpdate = true;
        texture.colorSpace = SRGBColorSpace;
        // texture.userData = {
        //     width: data.width,
        //     height: data.height,
        //     xOffset: data.xOffset,
        //     yOffset: data.yOffset,
        //     invWidth: 1 / data.width,
        //     invHeight: 1 / data.height,
        // }

        let geos: BufferGeometry[] = [];
        // ceil
        geos[0] = new PlaneGeometry(100, 100);
        geos[0].rotateX(HALF_PI);
        geos[0].translate(0, 100, 0);
        // floor
        geos[1] = new PlaneGeometry(100, 100);
        geos[1].rotateX(-HALF_PI);

        // left
        geos[2] = new PlaneGeometry(100, 100);
        geos[2].rotateY( Math.PI / 2 );
        geos[2].translate(-50, 50, 0);

        // right
        geos[3] = new PlaneGeometry(100, 100);
        geos[3].rotateY(-HALF_PI);
        geos[3].translate(50, 50, 0);

        // back
        geos[4] = new PlaneGeometry(100, 100);
        geos[4].translate(0, 50, -50);

        geometry = BufferGeometryUtils.mergeGeometries(geos);
        material = new MeshStandardMaterial({ color: 'white', map: texture });
    }
    const loaded = init();
</script>

<div class="h-screen w-screen">
<Canvas>
    <Stats />

    <T.PerspectiveCamera
        makeDefault
        fov={45}
        position.x={0}
        position.y={75}
        position.z={100}
    >
        <OrbitControls />
    </T.PerspectiveCamera>

    <T.PointLight
        args={[0xe7e7e7, 2.5, 100, 0]}
        position.y={30}
    />

    {#await loaded}
        Loading
    {:then}
        <T.Mesh
            position.y={-50}
            {geometry}
            {material}
        />
    {/await}
</Canvas>
</div>