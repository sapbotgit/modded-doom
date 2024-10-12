
export const TextureAtlasShader  = () => ({
    uniforms: {
        'tMap': { value: null },
        'tAtlas': { value: null },
        'tAtlasSize' : { value: 0 },
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
    uniform float time;
    uniform float alphaTest;
    uniform sampler2D tMap;
    uniform sampler2D tAtlas;

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