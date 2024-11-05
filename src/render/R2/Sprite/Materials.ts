import { DoubleSide, MeshBasicMaterial, MeshDepthMaterial, MeshDistanceMaterial, MeshStandardMaterial, UniformsUtils, Vector2, Vector3, Vector4, type DataTexture, type IUniform } from "three";
import type { SpriteSheet } from "./SpriteAtlas";
import { store } from "../../../doom";

// These materials are a giant mess. We could reduce some of the copy/paste but it doesn't make the shaders
// any easier to read. Hmmm...

export const inspectorAttributeName = 'doomInspect';
export function createSpriteMaterial(sprites: SpriteSheet, lightMap: DataTexture, lightLevels: DataTexture) {

    const vertexPars = `
    #include <common>

    uniform vec4 camQ;
    uniform vec3 camP;
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
    attribute vec4 motion;

    // NB: need to be flat due to sprite rotations. If we don't use flat, then one
    // side of the triangle will use one rotation and the other side another and
    // we get interpolation between two sprites and it looks terrible.
    flat out vec4 sUV;
    flat out vec2 vDim;
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

    const float split1 = 0.9238795325112867; //cos(PI/8);
    const float split2 = 0.38268343236508984; //cos(PI/8 * 3);
    float spriteRotation(vec4 tpos, float tdir, vec3 camP) {
        vec2 cdir = normalize( tpos.xy - camP.xy );
        vec2 vdir = vec2( cos(tdir), sin(tdir) );

        // dot and dot of a normal to figure out quadrant
        float dot1 = dot( cdir, vdir );
        float dot2 = dot( cdir, vec2(-vdir.y, vdir.x) );

        // WOW... there has got to be a better way to compute this.
        int rot =
            dot1 > split1 ? 4 :
            dot1 > split2 ? (dot2 > 0.0 ? 5 : 3) :
            dot1 < -split1 ? 0 :
            dot1 < -split2 ? (dot2 > 0.0 ? 7 : 1) :
            dot2 < split2 ? (dot1 > split1 ? 5 : 2) : 6;
        return float(rot);
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

    float fSpriteUVWidth = float(tSpriteUVsWidth);
    float invSpriteUVsWidth = 1.0 / fSpriteUVWidth;
    float spriteN = float(texN.x);
    vec2 tUV = vec2( mod(spriteN, fSpriteUVWidth), floor(spriteN * invSpriteUVsWidth));
    tUV = (tUV + .5) * invSpriteUVsWidth;
    // sprite info (offsets, mirrored, etc)
    ivec4 info = texture2D( tSpriteInfo, tUV );

    float rot = 0.0;
    if (info.w > 0) {
        // sprite has rotations so figure out which one to use
        // NB: don't use actual position here but use origin because we are rendering planes from (-.5,0,-.5)-(.5,0,.5)
        // so we really just choose one point otherwise some vertices may use a different rotation.
        vec4 pos = instanceMatrix * vec4( 0, 0, 0, 1 );
        rot = spriteRotation( pos, float(motion.w), camP );

        spriteN += rot;
        tUV = vec2( mod(spriteN, fSpriteUVWidth), floor(spriteN * invSpriteUVsWidth));
        tUV = (tUV + .5) * invSpriteUVsWidth;
        info = texture2D( tSpriteInfo, tUV );
    }

    // sprite dimensions
    sUV = texture2D( tSpriteUVs, tUV );
    vDim = vec2( sUV.z - sUV.x, sUV.w - sUV.y );
    // Would be really nice to do this and use vanilla map_fragment but it won't work for some reason.
    // perhaps there is a precision loss?
    // vMapUv = mod(vMapUv * vDim, vDim) + sUV.xy;
    `
    const begin_vertex = `
    #include <begin_vertex>

    renderShadows = flagBit(texN.y, flag_shadows);

    // scale and position based on texture size (vDim) and offsets
    vec2 dim = vDim * tSpritesWidth;
    float invertZ = 1.0 - 2.0 * flagBit(texN.y, flag_invertZOffset);
    float offZ = float(info.y) - dim.y;
    offZ = max(offZ, 0.0) + (dim.y * .5 * invertZ) + (flagBit(texN.y, flag_isMissile) * offZ);
    float sXY = dim.x * float(info.z);
    // only apply sprite offset on x-axis otherwise we're applying it twice and things won't look right
    // this fixes that pesky sprite wiggle on the burning barrel in Doom2's MAP23
    float offX = dim.x * .5 - float(info.x);
    mat4 scaleMat4 = mat4(
        sXY, 0.0,   0.0, offX,
        0.0, sXY,   0.0, 0.0,
        0.0, 0.0, dim.y, offZ,
        0.0, 0.0,   0.0, 1.0);

    transformed.xyz = (vec4(transformed, 1.0) * scaleMat4).xyz;
    // must apply after scale and offset otherwise offsets don't look right
    transformed = applyQuaternionToVector(camQ, transformed);

    // motion interpolation (motion = [speed/tic, direction, startTimeTics])
    const float notMoving = -0.01;
    float useMovement = (1.0 - flagBit(texN.y, flag_isFloating)) * step(notMoving, motion.y);
    float partialMove = motion.x * max(0.0, tics - motion.z) * useMovement;
    vec3 vMotion = vel * fract(tics);
    vMotion.x += cos(motion.y) * partialMove;
    vMotion.y += sin(motion.y) * partialMove;
    transformed += vMotion;
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

    flat in vec4 sUV;
    flat in vec2 vDim;
    varying float doomLightLevel;
    varying vec3 doomInspectorEmissive;
    varying float renderShadows;
    `;
    const depthDist_map_fragment = `
    #ifdef USE_MAP

    vec2 mapUV = mod(vMapUv * vDim, vDim) + sUV.xy;
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
        camP: IUniform;
    }
    const uniforms = store<MapMaterialUniforms>({
        dInspect: { value: -1 },
        doomExtraLight: { value: 0 },
        time: { value: 0 },
        tics: { value: 0 },
        camQ: { value: new Vector4() },
        camP: { value: new Vector3() },
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

            vec2 mapUV = mod(vMapUv * vDim, vDim) + sUV.xy;
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
