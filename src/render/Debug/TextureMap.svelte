<script lang="ts">
    import { T, useThrelte } from '@threlte/core';
    import { FloatType, BufferAttribute, BufferGeometry, Color, DataTexture, DoubleSide, Material, MeshBasicMaterial, MeshStandardMaterial, NearestFilter, PerspectiveCamera, PlaneGeometry, RepeatWrapping, ShaderMaterial, SRGBColorSpace, Uniform } from 'three';
    import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
    import { DoomWad, HALF_PI, WadFile } from '../../doom';
    import { WadStore } from '../../WadStore';

    let geometry: BufferGeometry;
    let material: Material;

    const threlte = useThrelte();

    const wallSize = 128;
    const wadStore = new WadStore();
    async function init() {
        const wadNames = ['doom']
        const wadResolvers = wadNames.map(name => wadStore.fetchWad(name).then(buff => new WadFile(name, buff)));
        const wads = await Promise.all(wadResolvers);
        const wad = new DoomWad(wadNames.join('+'), wads);

        const maxTx = threlte.renderer.capabilities.maxTextureSize / 32;
        console.log('t',maxTx,threlte.renderer.capabilities.floatFragmentTextures)

        const textureNames = wad.texturesNames();
        const atlasBuffer = new Float32Array(textureNames.length * 4);
        let off = { x: 0, y: 0 };
        for (let i = 0; i < textureNames.length; i++) {
            const tx = wad.wallTextureData(textureNames[i]);
            atlasBuffer[0 + i * 4] = off.x / maxTx;
            atlasBuffer[1 + i * 4] = off.y / maxTx;
            off.x += tx.width;
            if (off.x > maxTx) {
                off.x = 0;
                off.y += tx.height;
            }
            atlasBuffer[2 + i * 4] = off.x / maxTx;
            atlasBuffer[3 + i * 4] = (off.y + tx.height) / maxTx;
        }
        const tx = wad.wallTextureData('BIGDOOR1');
        atlasBuffer[0] = 0;
        atlasBuffer[1] = 0;
        atlasBuffer[2] = tx.width / maxTx;
        atlasBuffer[3] = tx.height / maxTx;
        console.log('abuff',atlasBuffer)
        const tAtlas = new DataTexture(atlasBuffer, textureNames.length, 1);
        tAtlas.type = FloatType;
        tAtlas.needsUpdate = true;

        // const data = wad.flatTextureData('CEIL3_5')
        // const data = wad.flatTextureData('FLOOR4_8')
        const data = wad.wallTextureData('BIGDOOR1');
        const buffer = new Uint8ClampedArray(maxTx * maxTx * 4);
        data.toAtlasBuffer(buffer, maxTx, 0, 0);
        const texture = new DataTexture(buffer, maxTx, maxTx)
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
        geos[0] = new PlaneGeometry(wallSize, wallSize);
        geos[0].rotateX(HALF_PI);
        geos[0].translate(0, wallSize, 0);
        geos[0].setAttribute('texN', new BufferAttribute(new Uint32Array([0, 0, 0, 0]), 1));

        // floor
        geos[1] = new PlaneGeometry(wallSize, wallSize);
        geos[1].rotateX(-HALF_PI);
        geos[1].setAttribute('texN', new BufferAttribute(new Uint32Array([0, 0, 0, 0]), 1));

        // left
        geos[2] = new PlaneGeometry(wallSize, wallSize);
        geos[2].rotateY(HALF_PI);
        geos[2].translate(-wallSize / 2, wallSize / 2, 0);
        geos[2].setAttribute('texN', new BufferAttribute(new Uint32Array([0, 0, 0, 0]), 1));

        // right
        geos[3] = new PlaneGeometry(wallSize, wallSize);
        geos[3].rotateY(-HALF_PI);
        geos[3].translate(wallSize / 2, wallSize / 2, 0);
        geos[3].setAttribute('texN', new BufferAttribute(new Uint32Array([0, 0, 0, 0]), 1));


        // back
        geos[4] = new PlaneGeometry(wallSize, wallSize);
        geos[4].translate(0, wallSize / 2, -wallSize / 2);
        geos[4].attributes.uv.array[1] = wallSize / data.height;
        geos[4].attributes.uv.array[2] = wallSize / data.width;
        geos[4].attributes.uv.array[3] = wallSize / data.height;
        geos[4].attributes.uv.array[6] = wallSize / data.width;
        geos[4].setAttribute('texN', new BufferAttribute(new Uint32Array([0, 0, 0, 0]), 1));
        console.log('attr',geos[4].attributes)

        geometry = BufferGeometryUtils.mergeGeometries(geos);

        let m = new ShaderMaterial({ ...MyShader() });
        m.uniforms.tAtlas.value = tAtlas;
        m.uniforms.tAtlasSize.value = textureNames.length;
        m.uniforms.tMap.value = texture;
        material = m;
    }
    const loaded = init();

    const MyShader = () => ({
        uniforms: {
            'light': { value: new Color('white') },
            'tMap': { value: null },
            'tAtlas': { value: null },
            'tAtlasSize' : { value: 0 },
            'tBack': { value: null },
            'time': { value: 1.0 },
        },

        vertexShader: /* glsl */`
        varying vec2 vUV;
        flat out uint tN;
        attribute uint texN;

        void main() {
            vUV = uv;
            tN = texN;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,

        fragmentShader: /* glsl */`
        uniform vec3 light;
        uniform float time;
        uniform float alphaTest;
        uniform sampler2D tMap;
        uniform sampler2D tAtlas;
        uniform uint tAtlasSize;
        uniform sampler2D tBack;

        varying vec2 vUV;
        flat in uint tN;

        // https://gamedev.stackexchange.com/questions/138384/how-do-i-avoid-using-the-wrong-texture2d-function-in-glsl
        #if __VERSION__ < 130
        #define TEXTURE2D texture2D
        #else
        #define TEXTURE2D texture
        #endif

        void main() {
            vec4 t1 = TEXTURE2D( tAtlas, vec2( tN, 0.0 ) );
            float w = t1.z - t1.x;
            float h = t1.w - t1.y;
            // TODO: Why +0.5 on the v coord??
            vec2 uv = vec2(
                mod(vUV.x * w - t1.x, w - t1.x) + t1.x,
                mod(vUV.y * h - t1.y, h - t1.y) + t1.y + 0.630);
            vec4 texel = TEXTURE2D( tMap, uv );
            if (texel.a < 1.0) {
                discard;
            }
            gl_FragColor = texel;
            // gl_FragColor = vec4(texel.x, texel.y, texel.z, 1.0);
            // gl_FragColor = vec4(uv.x, uv.y, 1.0, 1.0);
            // gl_FragColor = vec4(vUV.x, vUV.y, 1.0, 1.0);
            // gl_FragColor = vec4(t1.x, t1.y, t1.z, t1.w);
            // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }`,
    });
</script>


{#await loaded}
    Loading
{:then}
    <T.Mesh
        position.y={-wallSize / 2}
        {geometry}
        {material}
    />
{/await}
