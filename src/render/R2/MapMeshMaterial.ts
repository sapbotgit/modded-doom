import { MeshStandardMaterial } from "three";
import type { TextureAtlas } from "./TextureAtlas";
import type { MapRenderGeometry } from "./GeometryBuilder";

export function mapMeshMaterial(ta: TextureAtlas, mapGeo: MapRenderGeometry) {
    const material = new MeshStandardMaterial({ map: ta.texture });

    // extending threejs standard materials feels like a hack BUT doing it this way
    // allows us to take advantage of all the advanced capabilities there (like lighting)
    material.onBeforeCompile = shader => {
        shader.uniforms.tLightMap = { value: mapGeo.lightMap };
        shader.uniforms.numSectors = { value: mapGeo.lightMap.image.width };
        shader.uniforms.tMap = { value: ta.texture };
        shader.uniforms.tAtlas = { value: ta.atlas };
        shader.uniforms.numTextures = { value: ta.numTextures };

        shader.vertexShader = shader.vertexShader.replace('void main() {', `
        // texture index
        flat out uint tN;
        attribute uint texN;

        // doom light level
        flat out uint dL;
        attribute uint doomLight;

        void main() {
            tN = texN;
            dL = doomLight;
        `);

        shader.fragmentShader = `
        uniform float time;
        uniform float alphaTest;
        uniform sampler2D tAtlas;
        uniform sampler2D tLightMap;
        uniform uint numTextures;
        uniform uint numSectors;

        flat in uint tN;
        flat in uint dL;
        ` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP

        // texture dimensions
        vec4 t1 = texture2D( tAtlas, vec2( ((float(tN)) + .5) / float(numTextures), 0.5 ) );
        vec2 dim = vec2( t1.z - t1.x, t1.w - t1.y );

        vec2 uv = mod(vMapUv * dim, dim) + t1.xy;
        vec4 sampledDiffuseColor = texture2D( map, uv );
        #ifdef DECODE_VIDEO_TEXTURE
            // use inline sRGB decode until browsers properly support SRGB8_ALPHA8 with video textures (#26516)
            sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
        #endif
        diffuseColor *= sampledDiffuseColor;

        #endif

        // light level
        vec4 sectorLight = texture2D( tLightMap, vec2( (float(dL) + .5) / float(numSectors), 0.5 ) );
        diffuseColor.rgb *= sectorLight.rgb;

        totalEmissiveRadiance = vec3(0.0,1.0,0.0);
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '');
    };

    return material;
}