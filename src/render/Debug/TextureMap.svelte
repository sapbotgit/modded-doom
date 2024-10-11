<script lang="ts">
    import { T, useThrelte } from '@threlte/core';
    import { FloatType, BufferAttribute, BufferGeometry, Color, DataTexture, DoubleSide, Material, MeshBasicMaterial, MeshStandardMaterial, NearestFilter, PerspectiveCamera, PlaneGeometry, RepeatWrapping, ShaderMaterial, SRGBColorSpace, Uniform } from 'three';
    import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
    import { DoomWad, HALF_PI, TableRNG, WadFile, type Picture } from '../../doom';
    import { WadStore } from '../../WadStore';

    let geometry: BufferGeometry;
    let material: Material;

    const threlte = useThrelte();

    class TextureAtlas {
        readonly atlas: DataTexture;
        readonly texture: DataTexture;
        private textures: [string, Picture][];

        constructor(wad: DoomWad) {
            const maxTx = threlte.renderer.capabilities.maxTextureSize / 4;

            const textures = wad.texturesNames()
                .map<[string, Picture]>(e => [e, wad.wallTextureData(e)])
                .sort((a, b) => b[1].height - a[1].height);
            this.textures = textures;

            const atlasTexture = new Uint8ClampedArray(maxTx * maxTx * 4);
            const atlasMap = new Float32Array(textures.length * 4);
            let off = { x: 0, y: 0 };
            let maxH = -Infinity;
            for (let i = 0; i < textures.length; i++) {
                const tx = textures[i][1];
                if (textures[i][1].height > maxH) {
                    maxH = textures[i][1].height;
                }
                if (off.x + tx.width > maxTx) {
                    off.x = 0;
                    off.y += maxH;
                    maxH = -Infinity;
                }

                tx.toAtlasBuffer(atlasTexture, maxTx, off.x, off.y);

                atlasMap[0 + i * 4] = off.x / maxTx;
                atlasMap[1 + i * 4] = off.y / maxTx;
                off.x += tx.width;
                atlasMap[2 + i * 4] = off.x / maxTx;
                atlasMap[3 + i * 4] = (off.y + tx.height) / maxTx;
            }
            const tAtlas = new DataTexture(atlasMap, textures.length);
            tAtlas.type = FloatType;
            tAtlas.needsUpdate = true;
            this.atlas = tAtlas;

            // const data = wad.flatTextureData('CEIL3_5')
            // const data = wad.flatTextureData('FLOOR4_8')
            const texture = new DataTexture(atlasTexture, maxTx, maxTx)
            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;
            texture.magFilter = NearestFilter;
            // texture.flipY = true;
            texture.needsUpdate = true;
            // texture.colorSpace = SRGBColorSpace;
            this.texture = texture;
        }

        textureData(name: string): [number, Picture] {
            const index = this.textures.findIndex(e => e[0] === name);
            return [index / this.textures.length, this.textures[index][1]];
        }

        applyTexture(name: string, offsetX: number, offsetY: number, geo: BufferGeometry) {
            let [index, tx] = this.textureData(name);
            geo.attributes.uv.array[0] = 0;
            geo.attributes.uv.array[1] = ((wallSize % tx.height) - wallSize) / tx.height;
            geo.attributes.uv.array[2] = wallSize / tx.width;
            geo.attributes.uv.array[3] = ((wallSize % tx.height) - wallSize) / tx.height;
            geo.attributes.uv.array[4] = 0;
            geo.attributes.uv.array[5] = (wallSize % tx.height) / tx.height;
            geo.attributes.uv.array[6] = wallSize / tx.width;
            geo.attributes.uv.array[7] = (wallSize % tx.height) / tx.height;
            geo.setAttribute('texN', new BufferAttribute(new Float32Array(4).fill(index), 1));
        }
    }

    const wallSize = 300;
    const wadStore = new WadStore();
    async function init() {
        const wadNames = ['doom']
        const wadResolvers = wadNames.map(name => wadStore.fetchWad(name).then(buff => new WadFile(name, buff)));
        const wads = await Promise.all(wadResolvers);
        const wad = new DoomWad(wadNames.join('+'), wads);

        const ta = new TextureAtlas(wad);
        const textureNames = wad.texturesNames();

        let geos: BufferGeometry[] = [];
        // ceil
        geos[0] = new PlaneGeometry(wallSize, wallSize);
        geos[0].rotateX(HALF_PI);
        geos[0].translate(0, wallSize, 0);
        geos[0].setAttribute('texN', new BufferAttribute(new Float32Array([0, 0, 0, 0]), 1));

        // floor
        geos[1] = new PlaneGeometry(wallSize, wallSize);
        geos[1].rotateX(-HALF_PI);
        geos[1].setAttribute('texN', new BufferAttribute(new Float32Array([0, 0, 0, 0]), 1));

        // left
        geos[2] = new PlaneGeometry(wallSize, wallSize);
        geos[2].rotateY(HALF_PI);
        geos[2].translate(-wallSize / 2, wallSize / 2, 0);
        geos[2].setAttribute('texN', new BufferAttribute(new Float32Array([0, 0, 0, 0]), 1));

        // right
        geos[3] = new PlaneGeometry(wallSize, wallSize);
        geos[3].rotateY(-HALF_PI);
        geos[3].translate(wallSize / 2, wallSize / 2, 0);
        geos[3].setAttribute('texN', new BufferAttribute(new Float32Array([0, 0, 0, 0]), 1));


        // back
        geos[4] = new PlaneGeometry(wallSize, wallSize);
        geos[4].translate(0, wallSize / 2, -wallSize / 2);
        ta.applyTexture('BIGDOOR2', 0, 0, geos[4]);
        console.log('attr',geos[4].attributes)

        geometry = BufferGeometryUtils.mergeGeometries(geos);

        let m = new ShaderMaterial({ ...MyShader() });
        m.uniforms.tMap.value = ta.texture;
        m.uniforms.tAtlas.value = ta.atlas;
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
        flat out float tN;
        attribute float texN;

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
        uniform sampler2D tBack;

        varying vec2 vUV;
        flat in float tN;

        // https://gamedev.stackexchange.com/questions/138384/how-do-i-avoid-using-the-wrong-texture2d-function-in-glsl
        #if __VERSION__ < 130
        #define TEXTURE2D texture2D
        #else
        #define TEXTURE2D texture
        #endif

        void main() {
            vec4 t1 = TEXTURE2D( tAtlas, vec2( tN, 0.5 ) );
            vec2 dim = vec2( t1.z - t1.x, t1.w - t1.y );
            vec2 uv = mod(vUV * dim, dim) + t1.xy;
            // vec2 uv = vec2(
            //     mod(vUV.x * dim.x, dim.x),
            //     mod(vUV.y * dim.y, dim.y)) + t1.xy;
            vec4 texel = TEXTURE2D( tMap, uv );
            if (texel.a < 1.0) {
                discard;
            }
            gl_FragColor = texel;
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
