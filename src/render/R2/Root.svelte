<script lang="ts">
    import { MapObject, store, type MapRuntime } from "../../doom";
    import { useAppContext, useDoomMap } from "../DoomContext";
    import Stats from "../Debug/Stats.svelte";
    import SkyBox from "../Map/SkyBox.svelte";
    import Player from "../Map/Player.svelte";
    import MapGeometry from "./MapGeometry.svelte";
    import { T, useThrelte } from "@threlte/core";
    import { interactivity } from "@threlte/extras";
    import SectorThings from "./SectorThings.svelte";
    import EditorTagLink from "../Editor/EditorTagLink.svelte";
    import { BoxGeometry, InstancedMesh, MeshStandardMaterial, Matrix4, Vector3, Quaternion, Color, FrontSide, UniformsUtils, DataTexture, type IUniform, BufferAttribute, IntType, InstancedBufferAttribute } from "three";
    import { buildLightMap } from "./GeometryBuilder";
    import { TextureAtlas } from "./TextureAtlas";
    import { derived } from "svelte/store";

    export let map: MapRuntime;
    const { renderSectors } = useDoomMap();
    const { rev, trev } = map;
    const { extraLight } = map.player;
    let tracers: typeof map.tracers;
    $: if ($trev) {
        tracers = map.tracers;
    }

    const { editor } = useAppContext();
    const interact = interactivity({ enabled: $editor.active });
    $: interact.enabled.set($editor.active);

    // beware of hacking below...

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

    const inspectorAttributeName = 'doomInspect';
    function createMaterial(ta: TextureAtlas, lightMap: DataTexture, lightLevels: DataTexture) {

        const lightLevelParams = `
        flat out uint dL;
        attribute uint doomLight;

        flat out uvec2 dI;
        attribute uvec2 ${inspectorAttributeName};
        `
        const lightLevelInit = `
        dL = doomLight;
        dI = ${inspectorAttributeName};
        `;

        const vertexPars = `
        #include <common>

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

        uniform sampler2D tAtlas;
        uniform uint tAtlasWidth;
        uniform sampler2D tLightLevels;
        uniform sampler2D tLightMap;
        uniform uint tLightMapWidth;
        uniform uvec2 dInspect;
        uniform float doomExtraLight;
        uniform int doomFakeContrast;

        flat in vec3 normal_;
        flat in uint dL;
        flat in uint tN;
        flat in uvec2 dI;

        const float oneSixteenth = 1.0 / 16.0;
        float doomLightLevel(float level) {
            float light = level * 256.0;
            vec2 luv = vec2( mod(light, oneSixteenth), floor(light * oneSixteenth) );
            vec4 sectorLightLevel = texture2D( tLightLevels, (luv + .5) * oneSixteenth );
            return sectorLightLevel.g;
        }

        const float fakeContrastStep = 16.0 / 256.0;
        float fakeContrast(vec3 normal) {
            vec3 absNormal = abs(normal);
            if (doomFakeContrast == 2) {
                // gradual contrast
                return (smoothstep(0.0, 1.0, absNormal.x) * fakeContrastStep) -
                    (smoothstep(0.0, 1.0, absNormal.y) * fakeContrastStep);
            } else if (doomFakeContrast == 1) {
                // "classic" contrast that only impacts east-west are darker and north-south walls are brighter
                return
                    absNormal.y == 1.0 ? -fakeContrastStep
                    : absNormal.x == 1.0 ? fakeContrastStep
                    : 0.0;
            }
            return 0.0;
        }
        `;
        const fragmentMap = `
        #ifdef USE_MAP

        // texture dimensions
        vec4 t1 = texture2D( tAtlas, vec2( ((float(tN)) + .5) / float(tAtlasWidth), 0.5 ) );
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
            doomFakeContrast: IUniform;
        }
        const uniforms = store<MapMaterialUniforms>({
            dInspect: { value: [-1, -1] },
            doomExtraLight: { value: 0 },
            doomFakeContrast: { value: 0 },
        });

        const material = new MeshStandardMaterial({
            map: ta.texture,
            alphaTest: 1.0,
            shadowSide: FrontSide,
        });
        material.onBeforeCompile = shader => {
            shader.uniforms = UniformsUtils.merge([uniforms.val, shader.uniforms]);
            shader.uniforms.tLightLevels = { value: lightLevels };
            shader.uniforms.tLightMap = { value: lightMap };
            shader.uniforms.tLightMapWidth = { value: lightMap.image.width };
            shader.uniforms.tAtlas = { value: ta.index };
            shader.uniforms.tAtlasWidth = { value: ta.index.image.width };
            uniforms.set(shader.uniforms as any);

            shader.vertexShader = shader.vertexShader.replace('#include <common>', vertexPars + lightLevelParams);
            shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', vertexMain + lightLevelInit);

            shader.fragmentShader = shader.fragmentShader.replace('#include <common>', fragmentPars);
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
            #ifdef USE_MAP

            // texture dimensions
            vec4 t1 = texture2D( tAtlas, vec2( ((float(tN)) + .5) / float(tAtlasWidth), 0.5 ) );
            vec2 dim = vec2( t1.z - t1.x, t1.w - t1.y );

            vec2 mapUV = mod(vMapUv * dim, dim) + t1.xy;
            vec4 sampledDiffuseColor = texture2D( map, mapUV );
            sampledDiffuseColor.rgb = vColor.xyz;
            sampledDiffuseColor.a = 1.0;
            // if (sampledDiffuseColor.a < 1.0) discard;

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
            `);
            shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', `
                #include <lights_fragment_begin>

                // sector light level
                float dLf = float(dL);
                float invLightMapWidth = 1.0 / float(tLightMapWidth);
                vec2 lightUV = vec2(
                    mod(dLf, float(tLightMapWidth)),
                    floor(dLf * invLightMapWidth) );
                vec4 sectorLight = texture2D( tLightMap, (lightUV + .5) * invLightMapWidth );

                // sectorLight.rgb += fakeContrast(normal_);
                float scaledLightLevel = doomLightLevel(sectorLight.g + doomExtraLight);

                // apply lighting
                material.diffuseColor.rgb *= clamp(scaledLightLevel, 0.0, 1.0);
                // material.diffuseColor.rgb = vec3(scaledLightLevel);
                // material.diffuseColor.rgb = vec3(fakeContrast(normal_) * 4.0 + .5);
                // material.diffuseColor.rgb = abs(normal_);
                // material.diffuseColor.rgb = vColor.xyz;
            `);
        };
        return { material, uniforms };
    }

    const threlte = useThrelte();
    const { lightMap, lightLevels } = buildLightMap(renderSectors.map(e => e.sector));
    const maxTextureSize = Math.min(8192, threlte.renderer.capabilities.maxTextureSize);
    const ta = new TextureAtlas(map.game.wad, maxTextureSize);
    const { material, uniforms } = createMaterial(ta, lightMap, lightLevels);
    $: $uniforms.doomExtraLight.value = $extraLight / 255;

    // Are chunks actually beneficial? It's probably better than resizing/re-initializing a large array
    // but maybe worth experimenting with sometime.
    const chunkSize = 5_000;
    let thingsMeshes: InstancedMesh[] = [];
    const createChunk = () => {
        const mesh = new InstancedMesh(
            new BoxGeometry(),
            material,
            chunkSize,
        );
        mesh.geometry.setAttribute('doomLight', int16BufferFrom([0], chunkSize));
        mesh.geometry.setAttribute(inspectorAttributeName, int16BufferFrom([-1, -1], chunkSize));
        mesh.geometry.setAttribute('texN', int16BufferFrom([0], chunkSize));
        mesh.count = 0;
        // mesh.frustumCulled = false;
        // TODO: use setting.playerLight like MapGeometry?
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

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

        thingsMeshes[m].setColorAt(n, new Color(Math.floor(Math.random() * 0xffffff)))
        thingsMeshes[m].instanceColor.needsUpdate = true;

        const subs = [];
        rmobjs.set(mo.id, { mo, idx, subs });
        // custom attributes
        subs.push(mo.sector.subscribe(sec => {
            thingsMeshes[m].geometry.attributes.doomLight.array[n] = sec.num;
            thingsMeshes[m].geometry.attributes.doomLight.needsUpdate = true;
        }));
        const updatePos = (pos: Vector3, dir: number) => {
            q.setFromAxisAngle(up, dir);
            s.set(mo.info.radius, mo.info.radius, mo.info.height);
            p.copy(pos);
            p.z += mo.info.height * .5;
            thingsMeshes[m].setMatrixAt(n, mat.compose(p, q, s));
            thingsMeshes[m].instanceMatrix.needsUpdate = true;
        };
        subs.push(mo.direction.subscribe(dir => updatePos(mo.position.val, dir)));
        subs.push(mo.position.subscribe(pos => updatePos(pos, mo.direction.val)));
    //     thingsMeshes[m].geometry.attributes[inspectorAttributeName].array[n * 2 + 0] = 2;
    //     thingsMeshes[m].geometry.attributes[inspectorAttributeName].array[n * 2 + 1] = mo.id;
        // thingsMeshes[m].geometry.attributes[inspectorAttributeName].needsUpdate = true;
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
    <T is={mesh} />
{/each}

<!-- {#each renderSectors as renderSector}
    <SectorThings {renderSector} />
{/each} -->

<Player />

<EditorTagLink {map} />
