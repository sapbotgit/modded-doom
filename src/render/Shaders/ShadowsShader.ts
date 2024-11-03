import { Color } from "three";

// it's not an exact copy of the spectre effect but it's close enough for me (for now)
export const ShadowsShader = () => ({
    uniforms: {
        'light': { value: new Color('white') },
        'map': { value: null },
        'time': { value: 1.0 },
    },

    vertexShader: /* glsl */`
    #include <common>
    #include <logdepthbuf_pars_vertex>

    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        #include <logdepthbuf_vertex>
    }`,

    fragmentShader: /* glsl */`
    #include <common>
    #include <logdepthbuf_pars_fragment>

    uniform vec3 light;
    uniform float time;
    uniform float alphaTest;
    uniform sampler2D map;

    varying vec2 vUv;

    float noise( vec2 st ) {
        // vec2 v2 = vec2(12.9898,78.233);
        vec2 v2 = vec2(0.39, 0.41);
        return fract( sin( dot( st.xy, v2 ) ) * 43758.5453123);
    }

    void main() {
        vec4 texel = texture2D( map, vUv );
        if (texel.a < 1.0) {
            discard;
        }

        #include <logdepthbuf_fragment>

        vec2 ipos = floor(vUv * 200.0);
        float n = fract( time * noise(ipos) );
        gl_FragColor = vec4( vec3(0.0), n );
    }`,
});