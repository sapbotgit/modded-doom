import { DataTexture, FrontSide, MeshDepthMaterial, MeshDistanceMaterial, MeshStandardMaterial, type IUniform } from "three";
import type { TextureAtlas } from "./TextureAtlas";
import { store } from "../../doom";

export const inspectorAttributeName = 'doomInspect';

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

// texture index
flat out uint tN;
attribute uint texN;
`;
const vertexMain = `
tN = texN;

#include <uv_vertex>
`;

const fragmentPars = `
#include <common>

uniform sampler2D tAtlas;
uniform uint tAtlasWidth;
uniform sampler2D tLightMap;
uniform uint tLightMapWidth;
uniform uvec2 dInspect;
uniform float doomExtraLight;

flat in uint dL;
flat in uint tN;
flat in uvec2 dI;
`;
const fragmentMap = `
#ifdef USE_MAP

// texture dimensions
vec4 t1 = texture2D( tAtlas, vec2( ((float(tN)) + .5) / float(tAtlasWidth), 0.5 ) );
vec2 dim = vec2( t1.z - t1.x, t1.w - t1.y );

vec2 mapUV = mod(vMapUv * dim, dim) + t1.xy;
vec4 sampledDiffuseColor = texture2D( map, mapUV );
diffuseColor *= sampledDiffuseColor;

#endif
`;

interface MapMaterialUniforms {
    dInspect: IUniform;
    doomExtraLight: IUniform;
}

export function mapMeshMaterials(ta: TextureAtlas, lightMap: DataTexture) {
    // extending threejs standard materials feels like a hack BUT doing it this way
    // allows us to take advantage of all the advanced capabilities there
    // (like lighting and shadows)

    const uniforms = store<MapMaterialUniforms>({
        dInspect: { value: [-1, -1] },
        doomExtraLight: { value: 0 },
    });
    const material = new MeshStandardMaterial({
        map: ta.texture,
        alphaTest: 1.0,
        shadowSide: FrontSide,
    });
    material.onBeforeCompile = shader => {
        shader.uniforms.tLightMap = { value: lightMap };
        shader.uniforms.tLightMapWidth = { value: lightMap.image.width };
        shader.uniforms.tAtlas = { value: ta.index };
        shader.uniforms.tAtlasWidth = { value: ta.index.image.width };

        // this is a bit of a hack to allow the code to change material uniforms. We currently
        // only use it for the inspector but perhaps it could be useful elsewhere
        // I'm not sure how to do that yet
        shader.uniforms.dInspect = { value: [-1, -1] };
        shader.uniforms.doomExtraLight = { value: 0 };
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
        if (sampledDiffuseColor.a < 1.0) discard;

        if (dInspect == dI) {
            // faded magenta
            totalEmissiveRadiance = vec3(1.0, 0.0, 1.0) * .1;
        }

        #ifdef DECODE_VIDEO_TEXTURE
            // use inline sRGB decode until browsers properly support SRGB8_ALPHA8 with video textures (#26516)
            sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
        #endif
        diffuseColor *= sampledDiffuseColor;

        #endif

        // light level
        float dLf = float(dL);
        float invLightMapWidth = 1.0 / float(tLightMapWidth);
        vec2 lightUV = vec2(
            mod(dLf, float(tLightMapWidth)),
            floor(dLf * invLightMapWidth) );
        vec4 sectorLight = texture2D( tLightMap, (lightUV + .5) * invLightMapWidth );
        diffuseColor.rgb *= clamp(sectorLight.rgb + vec3(doomExtraLight), 0.0, 1.0);
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