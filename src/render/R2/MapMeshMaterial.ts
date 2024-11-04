import { DataTexture, FrontSide, MeshDepthMaterial, MeshDistanceMaterial, MeshStandardMaterial, UniformsUtils, type IUniform } from "three";
import type { TextureAtlas } from "./TextureAtlas";
import { store } from "../../doom";

export const inspectorAttributeName = 'doomInspect';

const lightLevelParams = `
flat out uint dL;
attribute uint doomLight;

uniform float time;
uniform uint tWidth;
attribute ivec2 doomOffset;
varying vec2 vOff;

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

vOff = vec2( float(doomOffset.x), float(doomOffset.y) ) * time / float(tWidth);
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
varying vec2 vOff;

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

vec2 mapUV = mod( vMapUv * dim + vOff, dim) + t1.xy;
vec4 sampledDiffuseColor = texture2D( map, mapUV );
diffuseColor *= sampledDiffuseColor;

#endif
`;

interface MapMaterialUniforms {
    dInspect: IUniform;
    doomExtraLight: IUniform;
    doomFakeContrast: IUniform;
    time: IUniform;
}

export function mapMeshMaterials(ta: TextureAtlas, lightMap: DataTexture, lightLevels: DataTexture) {
    // extending threejs standard materials feels like a hack BUT doing it this way
    // allows us to take advantage of all the advanced capabilities there
    // (like lighting and shadows)

    const uniforms = store<MapMaterialUniforms>({
        dInspect: { value: [-1, -1] },
        doomExtraLight: { value: 0 },
        doomFakeContrast: { value: 0 },
        time: { value: 0 },
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
        shader.uniforms.tWidth = { value: ta.texture.image.width };
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

        vec2 mapUV = mod( vMapUv * dim + vOff, dim) + t1.xy;
        vec4 sampledDiffuseColor = texture2D( map, mapUV );
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

            sectorLight.rgb += fakeContrast(normal_);
            float scaledLightLevel = doomLightLevel(sectorLight.g + doomExtraLight);

            // apply lighting
            material.diffuseColor.rgb *= clamp(scaledLightLevel, 0.0, 1.0);
            // material.diffuseColor.rgb = vec3(scaledLightLevel);
            // material.diffuseColor.rgb = vec3(fakeContrast(normal_) * 4.0 + .5);
            // material.diffuseColor.rgb = abs(normal_);
        `);
    };

    const depthMaterial = new MeshDepthMaterial();
    depthMaterial.onBeforeCompile = shader => {
        shader.uniforms.tAtlas = { value: ta.index };
        shader.uniforms.tAtlasWidth = { value: ta.index.image.width };

        shader.vertexShader = shader.vertexShader.replace('#include <common>', vertexPars);
        shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', vertexMain);

        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', fragmentPars);
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', fragmentMap);
    };

    const distanceMaterial = new MeshDistanceMaterial();
    distanceMaterial.onBeforeCompile = shader => {
        shader.uniforms.tAtlas = { value: ta.index };
        shader.uniforms.tAtlasWidth = { value: ta.index.image.width };

        shader.vertexShader = shader.vertexShader.replace('#include <common>', vertexPars);
        shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', vertexMain);

        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', fragmentPars);
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', fragmentMap);
    };

    return { material, depthMaterial, distanceMaterial, uniforms };
}