import { DoubleSide, MeshDepthMaterial, MeshDistanceMaterial, MeshStandardMaterial, UniformsUtils, Vector4, type DataTexture, type IUniform } from "three";
import type { SpriteSheet } from "./SpriteAtlas";
import { store } from "../../../doom";

// These materials are a giant mess. We could reduce some of the copy/paste but it doesn't make the shaders
// any easier to read. Hmmm...

export const inspectorAttributeName = 'doomInspect';
export function createSpriteMaterial(sprites: SpriteSheet, lightMap: DataTexture, lightLevels: DataTexture) {

    const vertexPars = `
    #include <common>

    uniform vec4 camQ;
    uniform sampler2D tSpriteUVs;
    uniform uint tSpriteUVsWidth;
    uniform isampler2D tSpriteInfo;
    uniform float tSpritesWidth;
    uniform sampler2D tLightLevels;
    uniform sampler2D tLightMap;
    uniform uint tLightMapWidth;
    uniform float doomExtraLight;
    uniform uint dInspect;
    uniform float time;
    uniform float tics;

    attribute uvec2 texN;
    attribute uint doomLight;
    attribute uint ${inspectorAttributeName};
    attribute vec3 vel;
    attribute vec3 motion;

    varying vec4 vT1;
    varying vec2 vDim;
    varying float doomLightLevel;
    varying vec3 doomInspectorEmissive;
    varying float renderShadows;

    const uint flag_fullBright = uint(0);
    const uint flag_isMissile = uint(1);
    const uint flag_invertZOffset = uint(2);
    const uint flag_shadows = uint(3);
    const uint flag_isFloating = uint(4);
    // returns 1.0 if flag is set or else 0.0
    float flagBit(uint val, uint bit) {
        return float((val >> bit) & uint(1));
    }

    const float oneSixteenth = 1.0 / 16.0;
    float scaleLightLevel(float level) {
        float light = level * 256.0;
        vec2 luv = vec2( mod(light, oneSixteenth), floor(light * oneSixteenth) );
        vec4 scaledLight = texture2D( tLightLevels, (luv + .5) * oneSixteenth );
        return scaledLight.g;
    }

    // https://discourse.threejs.org/t/instanced-geometry-vertex-shader-question/2694/3
    vec3 applyQuaternionToVector( vec4 q, vec3 v ){
        return v + 2.0 * cross( q.xyz, cross( q.xyz, v ) + q.w * v );
    }
    `;

    const uv_vertex = `
    #include <uv_vertex>

    vec2 tUV = vec2( ((float(texN.x)) + .5) / float(tSpriteUVsWidth), 0.5 );
    // sprite dimensions
    vT1 = texture2D( tSpriteUVs, tUV );
    vDim = vec2( vT1.z - vT1.x, vT1.w - vT1.y );
    // Would be really nice to do this and use vanilla map_fragment but it won't work for some reason.
    // perhaps there is a precision loss?
    // vMapUv = mod(vMapUv * vDim, vDim) + vT1.xy;
    `
    const begin_vertex = `
    #include <begin_vertex>

    transformed = applyQuaternionToVector(camQ, transformed);

    renderShadows = flagBit(texN.y, flag_shadows);

    // motion interpolation (motion = [speed/tic, direction, startTimeTics])
    const float notMoving = -0.01;
    float useMovement = (1.0 - flagBit(texN.y, flag_isFloating)) * step(notMoving, motion.y);
    float partialMove = motion.x * max(0.0, tics - motion.z) * useMovement;
    vec3 vMotion = vel * fract(tics);
    vMotion.x += cos(motion.y) * partialMove;
    vMotion.y += sin(motion.y) * partialMove;
    // vMotion = vec3(0.0);

    // scale and position based on texture size (vDim) and offsets
    vec2 dim = vDim * tSpritesWidth;
    // sprite info (offsets, mirrored, etc)
    ivec4 info = texture2D( tSpriteInfo, tUV );
    float invertZ = 1.0 - 2.0 * flagBit(texN.y, flag_invertZOffset);
    float offZ = float(info.y) - dim.y;
    offZ = max(offZ, 0.0) + (dim.y * .5 * invertZ) + (flagBit(texN.y, flag_isMissile) * offZ);
    float pXY = float(info.z) * dim.x;
    float offXY = float(info.x) - dim.x * .5;
    mat4 scaleMat4 = mat4(
        pXY, 0.0, 0.0, offXY + vMotion.x,
        0.0, pXY, 0.0, offXY + vMotion.y,
        0.0, 0.0, dim.y, offZ + vMotion.z,
        0.0, 0.0, 0.0, 1.0);
    transformed.xyz = (vec4(transformed, 1.0) * scaleMat4).xyz;
    `;

    const fragmentPars = `
    #include <common>

    // noise for objects with "shadows" flag (like spectres)
    float noise( vec2 st ) {
        // vec2 v2 = vec2(12.9898,78.233);
        vec2 v2 = vec2(0.39, 0.41);
        return fract( sin( dot( st.xy, v2 ) ) * 43758.5453123);
    }

    uniform float time;

    varying vec4 vT1;
    varying vec2 vDim;
    varying float doomLightLevel;
    varying vec3 doomInspectorEmissive;
    varying float renderShadows;
    `;
    const depthDist_map_fragment = `
    #ifdef USE_MAP

    vec2 mapUV = mod(vMapUv * vDim, vDim) + vT1.xy;
    vec4 sampledDiffuseColor = texture2D( map, mapUV );
    if (sampledDiffuseColor.a < 1.0) discard;

    sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.0), renderShadows);
    vec2 ipos = floor(vMapUv * 200.0);
    float n = fract( time * noise(ipos) );
    sampledDiffuseColor.a *= mix(sampledDiffuseColor.a, n, renderShadows);

    #endif
    `;

    interface MapMaterialUniforms {
        dInspect: IUniform;
        doomExtraLight: IUniform;
        time: IUniform;
        tics: IUniform;
        camQ: IUniform;
    }
    const uniforms = store<MapMaterialUniforms>({
        dInspect: { value: -1 },
        doomExtraLight: { value: 0 },
        time: { value: 0 },
        tics: { value: 0 },
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
        shader.uniforms.tSpriteInfo = { value: sprites.spriteInfo };
        shader.uniforms.tSpritesWidth = { value: sprites.sheet.image.width };
        shader.uniforms.tSpriteUVs = { value: sprites.uvIndex };
        shader.uniforms.tSpriteUVsWidth = { value: sprites.uvIndex.image.width };
        uniforms.set(shader.uniforms as any);

        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', vertexPars)
            .replace('#include <uv_vertex>', uv_vertex)
            .replace(`#include <beginnormal_vertex>`,`
            #include <beginnormal_vertex>
            objectNormal = normalize(applyQuaternionToVector(camQ, objectNormal));
            `)
            .replace(`#include <begin_vertex>`, begin_vertex + `
            // faded magenta if selected for inspection
            doomInspectorEmissive = step(float(${inspectorAttributeName} - dInspect), 0.0) * vec3(1.0, 0.0, 1.0) * .1;

            // sector light level
            float dLf = float(doomLight);
            float invLightMapWidth = 1.0 / float(tLightMapWidth);
            vec2 lightUV = vec2(
                mod(dLf, float(tLightMapWidth)),
                floor(dLf * invLightMapWidth) );
            vec4 sectorLight = texture2D( tLightMap, (lightUV + .5) * invLightMapWidth );
            float fullBright = flagBit(texN.y, flag_fullBright);
            doomLightLevel = clamp(scaleLightLevel(sectorLight.g + doomExtraLight + fullBright), 0.0, 1.0);
            `);

        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', fragmentPars)
            .replace('#include <map_fragment>', `
            // #include <map_fragment>
            #ifdef USE_MAP

            vec2 mapUV = mod(vMapUv * vDim, vDim) + vT1.xy;
            vec4 sampledDiffuseColor = texture2D( map, mapUV );

            // render shadows (optional)
            sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.0), renderShadows);
            float n = fract( time * noise( floor(vMapUv * 200.0) ) );
            sampledDiffuseColor.a *= mix(sampledDiffuseColor.a, n, renderShadows);

            #ifdef DECODE_VIDEO_TEXTURE
                // use inline sRGB decode until browsers properly support SRGB8_ALPHA8 with video textures (#26516)
                sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
            #endif
            diffuseColor *= sampledDiffuseColor;

            #endif

            totalEmissiveRadiance += doomInspectorEmissive;
            `)
            .replace('#include <lights_fragment_begin>', `
            #include <lights_fragment_begin>

            // apply lighting
            material.diffuseColor.rgb *= doomLightLevel;
            // material.diffuseColor.rgb = vec3(scaledLightLevel);
            // material.diffuseColor.rgb = abs(normal_);
            // material.diffuseColor.rgb = vColor.xyz;
            `);
    };

    const depthMaterial = new MeshDepthMaterial();
    depthMaterial.onBeforeCompile = shader => {
        shader.uniforms = UniformsUtils.merge([uniforms.val, shader.uniforms]);
        shader.uniforms.tSpriteInfo = { value: sprites.spriteInfo };
        shader.uniforms.tSpritesWidth = { value: sprites.sheet.image.width };
        shader.uniforms.tSpriteUVs = { value: sprites.uvIndex };
        shader.uniforms.tSpriteUVsWidth = { value: sprites.uvIndex.image.width };
        uniforms.subscribe(u => {
            shader.uniforms.camQ.value = u.camQ.value;
            shader.uniforms.tics.value = u.tics.value;
            shader.uniforms.time.value = u.time.value;
        });

        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', vertexPars)
            .replace('#include <uv_vertex>', uv_vertex)
            .replace(`#include <begin_vertex>`, begin_vertex);

        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', fragmentPars)
            .replace('#include <map_fragment>', depthDist_map_fragment);
    };

    const distanceMaterial = new MeshDistanceMaterial();
    distanceMaterial.onBeforeCompile = shader => {
        shader.uniforms = UniformsUtils.merge([uniforms.val, shader.uniforms]);
        shader.uniforms.tSpriteInfo = { value: sprites.spriteInfo };
        shader.uniforms.tSpritesWidth = { value: sprites.sheet.image.width };
        shader.uniforms.tSpriteUVs = { value: sprites.uvIndex };
        shader.uniforms.tSpriteUVsWidth = { value: sprites.uvIndex.image.width };
        // TODO: when do we unsubscribe? Can we avoid this subscription?
        uniforms.subscribe(u => {
            shader.uniforms.camQ.value = u.camQ.value;
            shader.uniforms.tics.value = u.tics.value;
            shader.uniforms.time.value = u.time.value;
        });

        // ideally we would "face" the light, not the camera but I don't fully understand the threejs shadow code
        // so I'm not quite sure how to do that. For now, this makes the shadow match the rendered sprite.
        // Perhaps rendering sprites as BoxGeometry would be slightly better?
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', vertexPars)
            .replace('#include <uv_vertex>', uv_vertex)
            .replace(`#include <begin_vertex>`, begin_vertex);

        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', fragmentPars)
            .replace('#include <map_fragment>', depthDist_map_fragment);
    };
    return { material, distanceMaterial, depthMaterial, uniforms };
}

export function createShadowsSpriteMaterial(sprites: SpriteSheet, lightMap: DataTexture, lightLevels: DataTexture) {
    const mat = createSpriteMaterial(sprites, lightMap, lightLevels);
    mat.material.alphaTest = 0;
    mat.material.depthWrite = false;
    mat.material.transparent = true;
    return mat;
}
