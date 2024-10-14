// These functions are pretty messy IMO. They get the job done though. These were some
// really helpful references I found along the way:
// https://graphtoy.com/
// https://lygia.xyz/
// https://thebookofshaders.com
// https://gist.github.com/patriciogonzalezvivo/986341af1560138dde52
export const ScreenColorShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'invunlTime': { value: 0.0 },
        'radiationTime': { value: 0.0 },
        'berserkTime': { value: 0.0 },
        'damageCount': { value: 0.0 },
        'bonusCount': { value: 0.0 },
    },

    vertexShader: /* glsl */`
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,

    fragmentShader: /* glsl */`
    uniform float invunlTime;
    uniform float radiationTime;
    uniform float berserkTime;
    uniform float damageCount;
    uniform float bonusCount;
    uniform sampler2D tDiffuse;

    varying vec2 vUv;

    const float PI = 3.1415926535897932384626433832795;
    const float PI_2 = 1.57079632679489661923;

    float flashTiming(float time, float cutoff, float period) {
        float ang = time / cutoff;
        float fade = cos( ang * cutoff * period * PI + PI ) * 0.5 + 0.5;
        float fn = smoothstep(1.0, cutoff, time);
        return ( fn + (1.0 - fn) * fade );
    }

    vec3 invulnColor(vec4 texel) {
        vec3 luma = vec3(0.299, 0.587, 0.114);
        vec3 grey = vec3(dot(texel.rgb, luma));
        return 1.0 - grey;
    }
    float invlunScale() {
        return flashTiming(invunlTime, 5.0, 0.5);
    }

    float damageScale() {
        return 0.89 * sin( min( 100.0, damageCount ) / 100.0 * PI_2 );
    }

    float berserkScale() {
        return 0.3 * sin( berserkTime / 20.0 );
    }

    float bonusScale() {
        return 0.1 * sin( min( 6.0, bonusCount ) / 6.0 * PI_2 );
    }

    float radiationScale() {
        return 0.2 * flashTiming(radiationTime, 6.0, 2.0);
    }

    void main() {
        vec3 red = vec3( 1.0, 0.0, 0.0 );
        vec3 green = vec3( 0.0, 1.0, 0.0 );
        vec3 gold = vec3( 1.0, 0.843, 0.0 );

        vec4 texel = texture2D( tDiffuse, vUv );
        vec3 invulnC = invulnColor(texel);
        vec3 damageC = red * damageScale();
        vec3 berserkC = red * berserkScale();
        vec3 bonusC = gold * bonusScale();
        vec3 radC = green * radiationScale();

        // mixin the radiation suit and damage colours to the base image (texel)
        // then mix invunerability (which may replace base) and add bonus
        vec3 base = mix(damageC, berserkC, 0.5) + radC + texel.rgb;
        vec3 color = mix(base, invulnC, invlunScale()) + bonusC;

        gl_FragColor = vec4( color, texel.a );
    }`,
};