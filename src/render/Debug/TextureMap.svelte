<script lang="ts">
    import { T, useThrelte } from '@threlte/core';
    import { Matrix4, FloatType, BufferAttribute, DoubleSide, BufferGeometry, Color, DataTexture, Material, NearestFilter, PlaneGeometry, RepeatWrapping, ShaderMaterial, SRGBColorSpace, Uniform } from 'three';
    import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
    import { DoomWad, HALF_PI, WadFile, type Picture, type Vertex } from '../../doom';
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
    }

    interface GeometryInfo {
        width: number;
        height: number;
        textureName: string;
        vertexOffset: number;
    }
    class MapRenderGeometryBuilder {
        private geos: BufferGeometry[] = [];
        private geoInfo: GeometryInfo[] = [];
        private vertexCount = 0;

        constructor(private textureAtlas: TextureAtlas) {}

        addGeometry(geo: BufferGeometry, textureName: string) {
            this.geos.push(geo);
            const vertexCount = geo.attributes.position.array.length / geo.attributes.position.itemSize;
            this.applyTexture(geo, textureName);

            this.geoInfo.push({
                textureName,
                width: geo.boundingBox.max.x - geo.boundingBox.min.x,
                height: geo.boundingBox.max.y - geo.boundingBox.min.y,
                vertexOffset: this.vertexCount,
            });
            this.vertexCount += vertexCount;

            return this.geos.length - 1;
        }

        private applyTexture(geo: BufferGeometry, textureName: string) {
            let [index, tx] = this.textureAtlas.textureData(textureName);
            geo.computeBoundingBox();
            const width = geo.boundingBox.max.x - geo.boundingBox.min.x;
            const height = geo.boundingBox.max.y - geo.boundingBox.min.y;
            geo.attributes.uv.array[0] = 0;
            geo.attributes.uv.array[1] = ((height % tx.height) - height) / tx.height;
            geo.attributes.uv.array[2] = width / tx.width;
            geo.attributes.uv.array[3] = ((height % tx.height) - height) / tx.height;
            geo.attributes.uv.array[4] = 0;
            geo.attributes.uv.array[5] = (height % tx.height) / tx.height;
            geo.attributes.uv.array[6] = width / tx.width;
            geo.attributes.uv.array[7] = (height % tx.height) / tx.height;
            geo.setAttribute('texN', new BufferAttribute(new Float32Array(4).fill(index), 1));
        }

        build() {
            const geometry = BufferGeometryUtils.mergeGeometries(this.geos);
            return new MapRenderGeometry(geometry, this.geoInfo, this.textureAtlas);
        }
    }

    class MapRenderGeometry {
        constructor(
            readonly geometry: BufferGeometry,
            readonly geoInfo: GeometryInfo[],
            readonly textureAtlas: TextureAtlas,
        ) {}

        applyTexture(geoIndex: number, textureName: string, offsetX: number, offsetY: number) {
            const geo = this.geometry;
            const info = this.geoInfo[geoIndex];
            info.textureName = textureName;
            const offset = info.vertexOffset;
            let [index, tx] = this.textureAtlas.textureData(textureName);
            geo.attributes.uv.array[2 * offset + 0] = 0;
            geo.attributes.uv.array[2 * offset + 1] = ((info.height % tx.height) - info.height) / tx.height;
            geo.attributes.uv.array[2 * offset + 2] = info.width / tx.width;
            geo.attributes.uv.array[2 * offset + 3] = ((info.height % tx.height) - info.height) / tx.height;
            geo.attributes.uv.array[2 * offset + 4] = 0;
            geo.attributes.uv.array[2 * offset + 5] = (info.height % tx.height) / tx.height;
            geo.attributes.uv.array[2 * offset + 6] = info.width / tx.width;
            geo.attributes.uv.array[2 * offset + 7] = (info.height % tx.height) / tx.height;
            if (!geo.attributes.texN) {
                geo.setAttribute('texN', new BufferAttribute(new Float32Array(4).fill(index), 1));
            } else {
                geo.attributes.texN.array[offset + 0] = index;
                geo.attributes.texN.array[offset + 1] = index;
                geo.attributes.texN.array[offset + 2] = index;
                geo.attributes.texN.array[offset + 3] = index;
            }
            geo.attributes.uv.needsUpdate = true;
            geo.attributes.texN.needsUpdate = true;
        }

        changeWallHeight(geoIndex: number, height: number) {
            const geo = this.geometry;
            const info = this.geoInfo[geoIndex];
            const offset = info.vertexOffset * 3;
            info.height = height;
            geo.attributes.position.array[offset + 1] = height + geo.attributes.position.array[offset + 7];
            geo.attributes.position.array[offset + 4] = height + geo.attributes.position.array[offset + 10];
            geo.attributes.position.needsUpdate = true;
            this.applyTexture(geoIndex, info.textureName, 0, 0);
        }
    }

    const stressTest = false;
    const animate = true;
    const wallSize = 300;

    const wadStore = new WadStore();
    async function init() {
        const wadNames = ['doom']
        const wadResolvers = wadNames.map(name => wadStore.fetchWad(name).then(buff => new WadFile(name, buff)));
        const wads = await Promise.all(wadResolvers);
        const wad = new DoomWad(wadNames.join('+'), wads);

        const ta = new TextureAtlas(wad);
        const mrgBuilder = new MapRenderGeometryBuilder(ta);
        const textureNames = wad.texturesNames();
        let geo: BufferGeometry;

        if (stressTest) {
            let size = 400_000;
            for (let i = 0; i < size; i++) {
                geo = new PlaneGeometry(Math.random() * wallSize + wallSize / 2, Math.random() * wallSize + wallSize / 2);
                mrgBuilder.addGeometry(geo, textureNames[i % textureNames.length]);

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
        mrgBuilder.addGeometry(geo, textureNames[0]);
        geo.rotateX(HALF_PI);
        geo.translate(0, wallSize, 0);

        // floor
        geo = new PlaneGeometry(wallSize, wallSize);
        mrgBuilder.addGeometry(geo, textureNames[1]);
        geo.rotateX(-HALF_PI);

        // left
        geo = new PlaneGeometry(wallSize, wallSize);
        mrgBuilder.addGeometry(geo, textureNames[2]);
        geo.rotateY(HALF_PI);
        geo.translate(-wallSize / 2, wallSize / 2, 0);

        // right
        geo = new PlaneGeometry(wallSize, wallSize);
        mrgBuilder.addGeometry(geo, textureNames[3]);
        geo.rotateY(-HALF_PI);
        geo.translate(wallSize / 2, wallSize / 2, 0);

        // // back
        geo = new PlaneGeometry(wallSize, wallSize);
        let backWall = mrgBuilder.addGeometry(geo, textureNames[14]);
        geo.translate(0, wallSize / 2, -wallSize / 2);

        const mapGeo = mrgBuilder.build();
        geometry = mapGeo.geometry;
        console.log('attr',geometry.attributes)

        let m = new ShaderMaterial({ ...MyShader(),side:DoubleSide });
        m.uniforms.tMap.value = ta.texture;
        m.uniforms.tAtlas.value = ta.atlas;
        material = m;

        if (animate) {
            let n = 0;
            setInterval(() => {
                for (let i = 0; i < (stressTest ? 100 : 1); i++) {
                    n = (n + 1) % textureNames.length;
                    let gi = stressTest ? Math.floor(Math.random() * mapGeo.geoInfo.length - 1) : backWall;
                    mapGeo.applyTexture(gi, textureNames[n], 0, 0);
                    gi = stressTest ? Math.floor(Math.random() * mapGeo.geoInfo.length - 1) : backWall;
                    mapGeo.changeWallHeight(gi, wallSize * Math.random() * 2);
                }
            }, stressTest ? 1 : 1000)
        }
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
