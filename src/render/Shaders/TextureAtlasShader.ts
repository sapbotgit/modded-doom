
export const TextureAtlasShader  = () => ({
    uniforms: {
        'tMap': { value: null },
        'tAtlas': { value: null },
        'tLightMap' : { value: 0 },
        'numSectors' : { value: 0 },
        'time': { value: 1.0 },
    },

    vertexShader: /* glsl */`
    varying vec2 vUV;

    // texture index
    flat out float tN;
    attribute float texN;

    // doom light level
    flat out uint dL;
    attribute uint doomLight;

    void main() {
        vUV = uv;
        tN = texN;
        dL = doomLight;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,

    fragmentShader: /* glsl */`
    uniform float time;
    uniform float alphaTest;
    uniform sampler2D tMap;
    uniform sampler2D tAtlas;
    uniform sampler2D tLightMap;
    uniform uint numSectors;

    varying vec2 vUV;
    flat in float tN;
    flat in uint dL;

    // https://gamedev.stackexchange.com/questions/138384/how-do-i-avoid-using-the-wrong-texture2d-function-in-glsl
    #if __VERSION__ < 130
    #define TEXTURE2D texture2D
    #else
    #define TEXTURE2D texture
    #endif

    void main() {
        // light level
        vec4 light = TEXTURE2D( tLightMap, vec2( float(dL) / float(numSectors), 0.5 ) );

        // texture dimensions
        vec4 t1 = TEXTURE2D( tAtlas, vec2( tN, 0.5 ) );
        vec2 dim = vec2( t1.z - t1.x, t1.w - t1.y );

        vec2 uv = mod(vUV * dim, dim) + t1.xy;
        vec4 texel = TEXTURE2D( tMap, uv );
        if (texel.a < 1.0) {
            discard;
        }
        // light = vec4(0.01, 0.01, 0.01, 1.0);
        gl_FragColor = texel * light;
        // gl_FragColor = light;
    }`,
});