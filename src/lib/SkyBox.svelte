<script lang="ts">
    import {  Color, CubeTexture, DataTexture, LinearToneMapping, SRGBColorSpace } from "three";
    import type { DoomMap } from "../doom";
    import { useDoom } from "./useDoom";
    import { AmbientLight, useThrelte } from "@threlte/core";

    const { scene, renderer } = useThrelte();
    const { textures } = useDoom();

    export let map: DoomMap;

    renderer.toneMapping = LinearToneMapping;
    renderer.toneMappingExposure = 1.3;

    // doom sky textures are 256x128 (it's actually more complicated https://doomwiki.org/wiki/Sky)
    // so we add another 128 pixels on top of the bottom 128 based on the colour of the first row)
    const width = 256
    const height = 256;
    const size = width * height;

    // offset the texture from the top of the screen because it looks "about right"
    // looks about right
    const topOffset = 45;
    // use avergae top row to form top and bottom of cubemap
    const topRowAvgColor = new Color(0, 0, 0);

    const sky1 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'].map(e => `MAP${e}`);
    const sky2 = ['12', '13', '14', '15', '16', '17', '18', '19', '20'].map(e => `MAP${e}`);
    const sky3 = ['21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32'].map(e => `MAP${e}`);
    const textureName =
        map.name.startsWith('E1') || sky1.includes(map.name) ? 'SKY1' :
        map.name.startsWith('E2') || sky2.includes(map.name) ? 'SKY2' :
        map.name.startsWith('E3') || sky3.includes(map.name) ? 'SKY3' :
        map.name.startsWith('E4') ? 'SKY4' :
        'SKY1'
    const sky = textures.get(textureName, 'wall');
    const pic = (sky as DataTexture).image.data;

    let buff = new Uint8Array(4 * size);
    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            const idx = j * width + i;
            // fill in the top with noisy pixels
            const noise = j < topOffset ? Math.floor(Math.random() * 12) : 0;
            const textureY =
                j < topOffset ? 0 :
                j > topOffset + 127 ? 127 - (j - 127 - topOffset) : // <-- reflection
                j - topOffset;
            const pidx = Math.min(textureY * width + i + noise, 256 * 128 - 1);
            buff[idx * 4 + 0] = pic[pidx * 4 + 0];
            buff[idx * 4 + 1] = pic[pidx * 4 + 1];
            buff[idx * 4 + 2] = pic[pidx * 4 + 2];
            buff[idx * 4 + 3] = pic[pidx * 4 + 3];

            if (textureY === 1) {
                topRowAvgColor.r += pic[pidx * 4 + 0] * pic[pidx * 4 + 0];
                topRowAvgColor.g += pic[pidx * 4 + 1] * pic[pidx * 4 + 1];
                topRowAvgColor.b += pic[pidx * 4 + 2] * pic[pidx * 4 + 2];
            }
        }
    }
    const skyWall = new DataTexture(buff, width, height);

    // why sqrt? https://sighack.com/post/averaging-rgb-colors-the-right-way
    topRowAvgColor.r = Math.sqrt(topRowAvgColor.r / width);
    topRowAvgColor.g = Math.sqrt(topRowAvgColor.g / width);
    topRowAvgColor.b = Math.sqrt(topRowAvgColor.b / width);

    // a little blurring to make the top and bottom transition a more gentle
    for (let i = 0; i < width; i++) {
        for (let j = 0; j < topOffset; j++) {
            let idx = j * width + i;
            const weight = 1 - (j / topOffset) * (j / topOffset);
            // mixing colors isn't straightforward https://stackoverflow.com/questions/4255973
            // (see also the sqr/sqrt stuff above)
            // fortunately threejs has a class to help
            let c = new Color(buff[idx * 4 + 0], buff[idx * 4 + 1], buff[idx * 4 + 2]);
            c.lerp(topRowAvgColor, weight);
            buff[idx * 4 + 0] = c.r;
            buff[idx * 4 + 1] = c.g;
            buff[idx * 4 + 2] = c.b;

            // bottom
            idx = (height - j) * width + i;
            c = new Color(buff[idx * 4 + 0], buff[idx * 4 + 1], buff[idx * 4 + 2]);
            c.lerp(topRowAvgColor, weight);
            buff[idx * 4 + 0] = c.r;
            buff[idx * 4 + 1] = c.g;
            buff[idx * 4 + 2] = c.b;

        }
    }

    buff = new Uint8Array(4 * size);
    for (let i = 0; i < size; i++) {
        buff[i * 4 + 0] = topRowAvgColor.r;
        buff[i * 4 + 1] = topRowAvgColor.g;
        buff[i * 4 + 2] = topRowAvgColor.b;
        buff[i * 4 + 3] = 255;
    }
    const skyTop = new DataTexture(buff, width, height);

    // we need to hand-rotate textures if we don't use the 0,1,0 up vector
    // https://github.com/mrdoob/three.js/issues/16328
    // the rendering code is much easier to work with because we can use z for up/down
    function rotate(texture: DataTexture, ang: 1 | 2 | 3) {
        let buff = new Uint8Array(4 * size);
        for (let i = 0; i < width; i++) {
            for (let j = 0; j < height; j++) {
                const src = j * width + i;
                // const out = (width - j) * width + i;
                const out =
                    ang === 1 ? (width - i - 1) * width + j :
                    ang === 2 ? i * width + (height - j) :
                    (height - j - 1) * width + (width - i);
                buff[out * 4 + 0] = texture.image.data[src * 4 + 0];
                buff[out * 4 + 1] = texture.image.data[src * 4 + 1];
                buff[out * 4 + 2] = texture.image.data[src * 4 + 2];
                buff[out * 4 + 3] = texture.image.data[src * 4 + 3];
            }
        }
        return new DataTexture(buff, width, height);
    }

    const tx = new CubeTexture([
        rotate(skyWall, 1),
        rotate(skyWall, 2),
        rotate(skyWall, 3),
        skyWall,
        skyTop,
        skyTop,
    ]);
    tx.colorSpace = SRGBColorSpace;
    tx.needsUpdate = true;
    scene.background = tx; //new Color('magenta');
</script>

<AmbientLight color={'white'} intensity={4} />