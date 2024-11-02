<script lang="ts">
    import { DoomWad, HALF_PI, MapObject, PlayerMapObject, SpriteNames, store, type MapRuntime, type Picture } from "../../doom";
    import { useAppContext, useDoomMap } from "../DoomContext";
    import Stats from "../Debug/Stats.svelte";
    import SkyBox from "../Map/SkyBox.svelte";
    import Player from "../Map/Player.svelte";
    import MapGeometry from "./MapGeometry.svelte";
    import { T, useThrelte } from "@threlte/core";
    import { interactivity } from "@threlte/extras";
    import SectorThings from "./SectorThings.svelte";
    import EditorTagLink from "../Editor/EditorTagLink.svelte";
    import { BackSide, BoxGeometry, FloatType, RepeatWrapping, NearestFilter, SRGBColorSpace, InstancedMesh, MeshStandardMaterial, Matrix4, Vector3, Quaternion, Color, FrontSide, UniformsUtils, DataTexture, type IUniform, IntType, InstancedBufferAttribute, PlaneGeometry, Vector4, Euler, Camera, DoubleSide, MeshDepthMaterial, MeshDistanceMaterial } from "three";
    import { buildLightMap } from "./GeometryBuilder";
    import { TextureAtlas } from "./TextureAtlas";
    import { onDestroy, onMount } from "svelte";

    export let map: MapRuntime;
    const { renderSectors, camera } = useDoomMap();
    const { rev, trev } = map;
    const { extraLight } = map.player;
    let tracers: typeof map.tracers;
    $: if ($trev) {
        tracers = map.tracers;
    }

    const { editor, settings } = useAppContext();
    const { playerLight } = settings;
    const interact = interactivity({ enabled: $editor.active });
    $: interact.enabled.set($editor.active);

    // beware of hacking below...
    function hit(ev) {
        ev.stopPropagation();

        const id = ev.object.geometry.attributes.doomInspect.array[ev.instanceId];
        $editor.selected = map.objs.find(e => e.id === id);
    }

    function findNearestPower2(n: number) {
        let t = 1;
        while (t < n) {
            t *= 2;
        }
        return t;
    }

    type RowEdge = { x: number, y: number, rowHeight: number };
    class SpriteSheet {
        readonly uvIndex: DataTexture;
        readonly spriteInfo: DataTexture;
        readonly sheet: DataTexture;
        private spriteFrames = new Map<string, Map<number, number>>;

        private count = 0;
        private rows: RowEdge[];

        constructor(wad: DoomWad, private tSize: number) {
            this.rows = [{ x: 0, y: 0, rowHeight: this.tSize }];

            const sprites = SpriteNames.map(sprite => wad.spriteFrames(sprite).flat().flat().map(f => ({ ...f, sprite }))).flat();

            // TODO: make this 2D like lightMap in case we have more than tSize textures?
            // TODO: probably should be nearest power of two width and height
            const uvIndexSize = sprites.length;
            const tAtlas = new DataTexture(new Float32Array(uvIndexSize * 4), uvIndexSize);
            tAtlas.type = FloatType;
            tAtlas.needsUpdate = true;
            this.uvIndex = tAtlas;

            const tSprintInfo = new DataTexture(new Int16Array(sprites.length * 4), sprites.length);
            tSprintInfo.type = IntType;
            tSprintInfo.needsUpdate = true;
            this.spriteInfo = tSprintInfo;

            const textureData = new Uint8ClampedArray(tSize * tSize * 4).fill(0);
            const texture = new DataTexture(textureData, tSize, tSize)
            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;
            texture.magFilter = NearestFilter;
            texture.colorSpace = SRGBColorSpace;
            texture.needsUpdate = true;
            this.sheet = texture;

            for (const frame of sprites) {
                const gfx = wad.spriteTextureData(frame.name);
                if (frame.rotation !== 0 && frame.rotation !== 1) {
                    // TODO: fix rotations
                    continue;
                }
                const idx = this.insert(frame.name, gfx);

                let frames = this.spriteFrames.get(frame.sprite);
                if (!frames) {
                    frames = new Map<number, number>();
                    this.spriteFrames.set(frame.sprite, frames);
                }
                frames.set(frame.frame, idx);
            }
        }

        indexOf(sprite: string, frame: number) {
            return this.spriteFrames.get(sprite).get(frame);
        }

        private insert(sprite: string, pic: Picture) {
            const row = this.findSpace(pic);
            if (!row) {
                // TODO: default texture?
                console.warn('texture atlas out of space', sprite);
                return null;
            }

            pic.toAtlasBuffer(this.sheet.image.data, this.tSize, row.x, row.y);
            this.sheet.needsUpdate = true;

            this.uvIndex.image.data[0 + this.count * 4] = row.x / this.tSize;
            this.uvIndex.image.data[1 + this.count * 4] = row.y / this.tSize;
            row.x += pic.width;
            this.uvIndex.image.data[2 + this.count * 4] = row.x / this.tSize;
            this.uvIndex.image.data[3 + this.count * 4] = (row.y + pic.height) / this.tSize;
            this.uvIndex.needsUpdate = true;

            // TODO: also offset and if there are rotations/mirrors?

            this.count += 1;
            return this.count - 1;
        }

        // To create on demand we'll need a map of rows with their starting height and xoffset
        // On each insert, we move the row pointer forward by width. If full, we shift down by height.
        // If we find a row of the exact height, use it.
        // If a texture is 80% the height of a row (like 112 of a 128 tall row) we insert it
        // Else we create a new row
        // We could do even better but there doesn't seem to be a need to (yet)
        private findSpace(pic: Picture): RowEdge {
            const perfectMatch = this.rows.find(row => row.rowHeight === pic.height && row.x + pic.width < this.tSize);
            if (perfectMatch) {
                return perfectMatch;
            }

            const noSplit = this.rows.find(row => pic.height < row.rowHeight && pic.height / row.rowHeight > .8 && row.x + pic.width < this.tSize);
            if (noSplit) {
                return noSplit;
            }

            // const smallFit = this.rows.find(row => pic.height < row.rowHeight && pic.height / row.rowHeight <= .3 && row.x + pic.width < this.tSize);
            // if (smallFit) {
            //     // split the row so insert a new row with the remainder of the space
            //     this.rows.push({ x: smallFit.x, y: smallFit.y + pic.height, rowHeight: smallFit.rowHeight - pic.height });
            //     // and change the row height to match the picture we're inserting
            //     smallFit.rowHeight = pic.height;
            //     return smallFit;
            // }

            const end = this.rows[this.rows.length - 1];
            if (end.rowHeight >= pic.height) {
                // split
                this.rows.push({ x: end.x, y: end.y + pic.height, rowHeight: end.rowHeight - pic.height });
                end.rowHeight = pic.height;
                return end;
            }
            // no space!
            return null;
        }
    }

    const threlte = useThrelte();
    const maxTextureSize = Math.min(8192, threlte.renderer.capabilities.maxTextureSize);
    const spriteSheet = new SpriteSheet(map.game.wad, maxTextureSize);

    // function imageUrl(tx: DataTexture) {
    //     const canvas = document.createElement('canvas');
    //     canvas.width = tx.image.width;
    //     canvas.height = tx.image.height;
    //     const ctx = canvas.getContext('2d');
    //     const img = ctx.createImageData(canvas.width, canvas.height);
    //     img.data.set(tx.image.data);
    //     ctx.putImageData(img, 0, 0);

    //     // convert to data url
    //     const dataUrl = canvas.toDataURL('image/png');
    //     return dataUrl;
    // }

    // const img = document.createElement('img')
    // img.src = imageUrl(spriteSheet.sheet)
    // img.style.position = 'absolute';
    // img.style.right = '0px';
    // onMount(() => document.body.appendChild(img));
    // onDestroy(() => {
    //     document.body.removeChild(img)
    // });

    const inspectorAttributeName = 'doomInspect';
    function createMaterial(sprites: SpriteSheet, lightMap: DataTexture, lightLevels: DataTexture) {

        const lightLevelParams = `
        flat out uint dL;
        attribute uint doomLight;

        flat out uint dI;
        attribute uint ${inspectorAttributeName};
        `
        const lightLevelInit = `
        dL = doomLight;
        dI = ${inspectorAttributeName};
        `;

        const vertexPars = `
        #include <common>

        uniform vec4 camQ;
        uniform sampler2D tSpriteUVs;
        uniform float tSpritesWidth;
        uniform uint tSpriteUVsWidth;
        flat out vec4 vT1;
        flat out vec2 vDim;

        // https://discourse.threejs.org/t/instanced-geometry-vertex-shader-question/2694/3
        vec3 applyQuaternionToVector( vec4 q, vec3 v ){
            return v + 2.0 * cross( q.xyz, cross( q.xyz, v ) + q.w * v );
        }

        flat out vec3 normal_;
        // texture index
        flat out uint tN;
        attribute uint texN;
        `;
        const vertexMain = `
        tN = texN;
        normal_ = normal;

        #include <uv_vertex>
        `;

        const fragmentPars = `
        #include <common>

        uniform sampler2D tSpriteUVs;
        uniform uint tSpriteUVsWidth;
        uniform sampler2D tLightLevels;
        uniform sampler2D tLightMap;
        uniform uint tLightMapWidth;
        uniform uint dInspect;
        uniform float doomExtraLight;

        flat in vec4 vT1;
        flat in vec2 vDim;

        flat in vec3 normal_;
        flat in uint dL;
        flat in uint tN;
        flat in uint dI;

        const float oneSixteenth = 1.0 / 16.0;
        float doomLightLevel(float level) {
            float light = level * 256.0;
            vec2 luv = vec2( mod(light, oneSixteenth), floor(light * oneSixteenth) );
            vec4 sectorLightLevel = texture2D( tLightLevels, (luv + .5) * oneSixteenth );
            return sectorLightLevel.g;
        }
        `;
        const fragmentMap = `
        #ifdef USE_MAP

        // texture dimensions
        vec2 tUV = vec2( ((float(tN)) + .5) / float(tSpriteUVsWidth), 0.5 )
        vec4 t1 = texture2D( tSpriteUVs, tUV );
        vec2 dim = vec2( t1.z - t1.x, t1.w - t1.y );

        vec2 mapUV = mod(vMapUv * dim, dim) + t1.xy;
        vec4 sampledDiffuseColor = texture2D( map, mapUV );
        sampledDiffuseColor = vec4(1.0);
        diffuseColor *= sampledDiffuseColor;

        #endif
        `;
        interface MapMaterialUniforms {
            dInspect: IUniform;
            doomExtraLight: IUniform;
            camQ: IUniform;
        }
        const uniforms = store<MapMaterialUniforms>({
            dInspect: { value: -1 },
            doomExtraLight: { value: 0 },
            camQ: { value: new Vector4() },
        });

        const material = new MeshStandardMaterial({
            map: sprites.sheet,
            alphaTest: 1.0,
            side: DoubleSide, // we only need FrontSide for rendering but inspector seems to need DoubleSide
            shadowSide: DoubleSide,
        });
        material.onBeforeCompile = shader => {
            shader.uniforms = UniformsUtils.merge([uniforms.val, shader.uniforms]);
            shader.uniforms.tLightLevels = { value: lightLevels };
            shader.uniforms.tLightMap = { value: lightMap };
            shader.uniforms.tLightMapWidth = { value: lightMap.image.width };
            shader.uniforms.tSpritesWidth = { value: sprites.sheet.image.width };
            shader.uniforms.tSpriteUVs = { value: sprites.uvIndex };
            shader.uniforms.tSpriteUVsWidth = { value: sprites.uvIndex.image.width };
            uniforms.set(shader.uniforms as any);

            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', vertexPars + lightLevelParams)
                .replace('#include <uv_vertex>', vertexMain + lightLevelInit + `

                // sprite dimensions
                vec2 tUV = vec2( ((float(tN)) + .5) / float(tSpriteUVsWidth), 0.5 );
                vT1 = texture2D( tSpriteUVs, tUV );
                vDim = vec2( vT1.z - vT1.x, vT1.w - vT1.y );
                `)
                .replace(`#include <beginnormal_vertex>`,`
                #include <beginnormal_vertex>
                objectNormal = normalize(applyQuaternionToVector(camQ, objectNormal));
                `)
                .replace(`#include <begin_vertex>`,`
                #include <begin_vertex>
                transformed = applyQuaternionToVector(camQ, transformed);

                // scale based on texture size (vDim)
                mat4 scaleMat4 = mat4(
                    vDim.x * tSpritesWidth, 0.0, 0.0, 0.0,
                    0.0, vDim.x * tSpritesWidth, 0.0, 0.0,
                    0.0, 0.0, vDim.y * tSpritesWidth, (vDim.y * tSpritesWidth) * .5,
                    0.0, 0.0, 0.0, 1.0);
                transformed.xyz = (vec4(transformed, 1.0) * scaleMat4).xyz;
                `);

            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', fragmentPars)
                .replace('#include <map_fragment>', `
                #ifdef USE_MAP

                vec2 mapUV = mod(vMapUv * vDim, vDim) + vT1.xy;
                vec4 sampledDiffuseColor = texture2D( map, mapUV );
                // sampledDiffuseColor.rgb = vColor.xyz;
                // sampledDiffuseColor.a = 1.0;
                if (sampledDiffuseColor.a < 1.0) discard;

                #ifdef DECODE_VIDEO_TEXTURE
                    // use inline sRGB decode until browsers properly support SRGB8_ALPHA8 with video textures (#26516)
                    sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
                #endif
                diffuseColor *= sampledDiffuseColor;

                #endif

                if (dInspect == dI) {
                    // faded magenta
                    totalEmissiveRadiance = vec3(1.0, 0.0, 1.0) * .1;
                }
                `)
                .replace('#include <lights_fragment_begin>', `
                #include <lights_fragment_begin>

                // sector light level
                float dLf = float(dL);
                float invLightMapWidth = 1.0 / float(tLightMapWidth);
                vec2 lightUV = vec2(
                    mod(dLf, float(tLightMapWidth)),
                    floor(dLf * invLightMapWidth) );
                vec4 sectorLight = texture2D( tLightMap, (lightUV + .5) * invLightMapWidth );

                float scaledLightLevel = doomLightLevel(sectorLight.g + doomExtraLight);

                // apply lighting
                material.diffuseColor.rgb *= clamp(scaledLightLevel, 0.0, 1.0);
                // material.diffuseColor.rgb = vec3(scaledLightLevel);
                // material.diffuseColor.rgb = abs(normal_);
                // material.diffuseColor.rgb = vColor.xyz;
                `);
        };

        const depthMaterial = new MeshDepthMaterial();
        depthMaterial.onBeforeCompile = shader => {
            shader.uniforms = UniformsUtils.merge([uniforms.val, shader.uniforms]);
            shader.uniforms.tSpriteUVs = { value: sprites.uvIndex };
            shader.uniforms.tSpriteUVsWidth = { value: sprites.uvIndex.image.width };
            uniforms.subscribe(u => {
                shader.uniforms.camQ.value = u.camQ.value;
            })

            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', vertexPars)
                .replace('#include <uv_vertex>', vertexMain)
                // .replace(`#include <beginnormal_vertex>`,
                // `#include <beginnormal_vertex>
                // // objectNormal = vec3(0, 1, 0);
                // objectNormal = normalize(applyQuaternionToVector(camQ, objectNormal));
                // `)
                .replace(`#include <begin_vertex>`,
                `#include <begin_vertex>
                transformed = applyQuaternionToVector(camQ, transformed);
                `);

            shader.fragmentShader = shader.fragmentShader.replace('#include <common>', fragmentPars);
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', fragmentMap);
        };

        const distanceMaterial = new MeshDistanceMaterial();
        distanceMaterial.onBeforeCompile = shader => {
            shader.uniforms = UniformsUtils.merge([uniforms.val, shader.uniforms]);
            shader.uniforms.tSpriteUVs = { value: sprites.uvIndex };
            shader.uniforms.tSpriteUVsWidth = { value: sprites.uvIndex.image.width };
            // TODO: when do we unsubscribe? Can we avoid this subscription?
            uniforms.subscribe(u => {
                shader.uniforms.camQ.value = u.camQ.value;
            })

            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', vertexPars)
                .replace('#include <uv_vertex>', vertexMain)
                // ideally we would "face" the light, not the camera but I don't fully understand the threejs shadow code
                // so I'm not quite sure how to do that. For now, this makes the shadow match the rendered sprite.
                // Perhaps rendering sprites as BoxGeometry would be slightly better?
                .replace(`#include <begin_vertex>`,
                `#include <begin_vertex>
                transformed = applyQuaternionToVector(camQ, transformed);
                `);

            shader.fragmentShader = shader.fragmentShader.replace('#include <common>', fragmentPars);
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', fragmentMap);
        };
        return { material, distanceMaterial, depthMaterial, uniforms };
    }

    // https://discourse.threejs.org/t/mesh-points-to-the-camera-on-only-2-axis-with-shaders/21555/7
    const threlteCam = threlte.camera;
    const { position, angle } = camera;
    const _q = new Quaternion();
    const _z0 = new Vector3(1, 0, 0);
    const _z1 = new Vector3();
    $: $uniforms.camQ.value.copy(updateCamera($threlteCam, $position, $angle));
    function updateCamera(cam: Camera, p: Vector3, a: Euler) {
        cam.getWorldDirection(_z1);
        // _z1.set(0, 0, -1);
        // _z1.applyEuler(a);
        _z1.setZ(0).negate().normalize();
        _q.setFromUnitVectors(_z0, _z1);
        return _q;
    }

    const { lightMap, lightLevels } = buildLightMap(renderSectors.map(e => e.sector));
    const { material, depthMaterial, distanceMaterial, uniforms } = createMaterial(spriteSheet, lightMap, lightLevels);
    $: $uniforms.doomExtraLight.value = $extraLight / 255;
    $: ((edit) => {
        // map objects have 'health' so only handle those
        $uniforms.dInspect.value = edit.selected && 'health' in edit.selected
            ? edit.selected.id
            // clear selection
            : -1;
    })($editor);

    // Are chunks actually beneficial? It's probably better than resizing/re-initializing a large array
    // but maybe worth experimenting with sometime.
    const chunkSize = 5_000;
    // const geometry = new BoxGeometry();
    const geometry = new PlaneGeometry();
    geometry.rotateX(-HALF_PI);

    let thingsMeshes: InstancedMesh[] = [];
    const int16BufferFrom = (items: number[], vertexCount: number) => {
        const array = new Uint16Array(items.length * vertexCount);
        for (let i = 0; i < vertexCount * items.length; i += items.length) {
            for (let j = 0; j < items.length; j++) {
                array[i + j] = items[j];
            }
        }
        const attr = new InstancedBufferAttribute(array, items.length);
        attr.gpuType = IntType;
        return attr;
    }
    const createChunk = () => {
        const mesh = new InstancedMesh(geometry, material, chunkSize);
        mesh.customDepthMaterial = depthMaterial;
        mesh.customDistanceMaterial = distanceMaterial;
        mesh.geometry.setAttribute('doomLight', int16BufferFrom([0], chunkSize));
        mesh.geometry.setAttribute(inspectorAttributeName, int16BufferFrom([-1], chunkSize));
        mesh.geometry.setAttribute('texN', int16BufferFrom([0], chunkSize));
        mesh.count = 0;
        // mesh.frustumCulled = false;
        return mesh;
    }
    $: usePlayerLight = $playerLight !== '#000000';
    $: thingsMeshes.forEach(m => {
        m.castShadow = usePlayerLight;
        m.receiveShadow = usePlayerLight;
    });

    interface RenderInfo {
        idx: number;
        mo: MapObject;
        subs: (() => void)[];
    }
    const rmobjs = new Map<number, RenderInfo>();

    const mat = new Matrix4();
    const p = new Vector3( 1, 1, 1 );
    const q = new Quaternion();
    const s = new Vector3( 1, 1, 1 );
    const up = new Vector3(0, 0, 1);
    function add(mo: MapObject, idx: number) {
        let m = Math.floor(idx / chunkSize);
        let n = idx % chunkSize;
        if (n === 0 && idx > 0) {
            // this chunk is full
            thingsMeshes[m - 1].count = chunkSize;
        }
        // create new chunk if needed
        if (thingsMeshes.length === m) {
            thingsMeshes.push(createChunk());
            thingsMeshes = thingsMeshes;
        }
        // set count on last chunk (assume everything else stays at chunkSize)
        // NB: count will not decrease because removed items may not be at the end of the list
        thingsMeshes[m].count = Math.max(n, thingsMeshes[m].count);

        // thingsMeshes[m].setColorAt(n, new Color(Math.floor(Math.random() * 0xffffff)))
        // thingsMeshes[m].instanceColor.needsUpdate = true;

        const subs = [];
        rmobjs.set(mo.id, { mo, idx, subs });
        // custom attributes
        subs.push(mo.sector.subscribe(sec => {
            thingsMeshes[m].geometry.attributes.doomLight.array[n] = sec.num;
            thingsMeshes[m].geometry.attributes.doomLight.needsUpdate = true;
        }));
        const updatePos = (pos: Vector3) => {
            q.setFromAxisAngle(up, HALF_PI);
            s.set(1, 1, 1);
            if (mo instanceof PlayerMapObject) {
                s.set(0, 0, 0);
            }
            p.copy(pos);
            p.z += .5;
            thingsMeshes[m].setMatrixAt(n, mat.compose(p, q, s));
            thingsMeshes[m].instanceMatrix.needsUpdate = true;
        };
        // subs.push(mo.direction.subscribe(dir => updatePos(mo.position.val, dir)));
        subs.push(mo.position.subscribe(pos => updatePos(pos)));
        subs.push(mo.sprite.subscribe(sprite => {
            if (!sprite) return;
            const spriteIndex = spriteSheet.indexOf(sprite.name, sprite.frame);
            thingsMeshes[m].geometry.attributes.texN.array[n] = spriteIndex;
            thingsMeshes[m].geometry.attributes.texN.needsUpdate = true;
        }));

        thingsMeshes[m].geometry.attributes[inspectorAttributeName].array[n] = mo.id;
        thingsMeshes[m].geometry.attributes[inspectorAttributeName].needsUpdate = true;
    }
    function destroy(mo: MapObject) {
        const info = rmobjs.get(mo.id);
        info.subs.forEach(fn => fn());
        rmobjs.delete(mo.id);

        let m = Math.floor(info.idx / chunkSize);
        let n = info.idx % chunkSize;
        // We can't actually remove an instanced geometry but we can hide it until something else uses the free slot.
        // We hide by moving it far away or scaling it very tiny (making it effectively invisible)
        s.set(0, 0, 0);
        thingsMeshes[m].setMatrixAt(n, mat.compose(p, q, s));
        thingsMeshes[m].instanceMatrix.needsUpdate = true;
        return info.idx;
    }

    const freeSlots: number[] = [];
    $: (n => {
        let added = new Set<MapObject>();
        let updated = new Set<MapObject>();
        let removed = new Set<MapObject>();

        // it would be nice if this was moved into MapRuntime and we just get notification on add/remove/update
        for (const mo of map.objs) {
            const set = rmobjs.has(mo.id) ? updated : added;
            set.add(mo);
        }
        for (const mo of rmobjs) {
            if (!added.has(mo[1].mo) && !updated.has(mo[1].mo)) {
                removed.add(mo[1].mo);
            }
        }

        let idx = 0;
        for (const mo of updated) {
            // TBD?
            idx += 1;
        }
        for (const mo of removed) {
            const id = destroy(mo);
            freeSlots.push(id);
        }
        for (const mo of added) {
            let slot = freeSlots.pop() ?? idx;
            if (slot === idx) {
                idx += 1;
            }
            add(mo, slot);
        }
    })($rev);
</script>

<Stats />

<SkyBox />

<MapGeometry />

{#each thingsMeshes as mesh}
    <T is={mesh} on:click={hit} />
{/each}

<!-- {#each renderSectors as renderSector}
    <SectorThings {renderSector} />
{/each} -->

<Player />

<EditorTagLink {map} />
