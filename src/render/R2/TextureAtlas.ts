import { DataTexture, FloatType, NearestFilter, RepeatWrapping, SRGBColorSpace } from "three";
import type { DoomWad, Picture } from "../../doom";

export class TextureAtlas {
    readonly atlas: DataTexture;
    readonly texture: DataTexture;
    private textures: [string, Picture][];

    constructor(wad: DoomWad, tSize: number) {

        const textures = wad.texturesNames()
            .map<[string, Picture]>(e => [e, wad.wallTextureData(e)])
            .sort((a, b) => b[1].height - a[1].height);
        this.textures = textures;

        const atlasTexture = new Uint8ClampedArray(tSize * tSize * 4);
        const flats = wad.flatsNames().map<[string, Picture]>(e => [e, wad.flatTextureData(e)]);
        const atlasMap = new Float32Array((textures.length + flats.length) * 4);

        let off = { x: 0, y: 0 };
        let maxH = -Infinity;
        for (let i = 0; i < textures.length; i++) {
            const tx = textures[i][1];
            if (textures[i][1].height > maxH) {
                maxH = textures[i][1].height;
            }
            if (off.x + tx.width > tSize) {
                off.x = 0;
                off.y += maxH;
                maxH = -Infinity;
            }

            tx.toAtlasBuffer(atlasTexture, tSize, off.x, off.y);

            atlasMap[0 + i * 4] = off.x / tSize;
            atlasMap[1 + i * 4] = off.y / tSize;
            off.x += tx.width;
            atlasMap[2 + i * 4] = off.x / tSize;
            atlasMap[3 + i * 4] = (off.y + tx.height) / tSize;
        }

        off.x = 0;
        off.y += maxH;
        for (let i = 0; i < flats.length; i++) {
            const tx = flats[i][1];
            if (off.x + 64 > tSize) {
                off.x = 0;
                off.y += 64;
            }

            tx.toAtlasBuffer(atlasTexture, tSize, off.x, off.y);

            atlasMap[0 + textures.length * 4] = off.x / tSize;
            atlasMap[1 + textures.length * 4] = off.y / tSize;
            off.x += 64;
            atlasMap[2 + textures.length * 4] = off.x / tSize;
            atlasMap[3 + textures.length * 4] = (off.y + 64) / tSize;
            this.textures.push(flats[i])
        }

        const tAtlas = new DataTexture(atlasMap, textures.length);
        tAtlas.type = FloatType;
        tAtlas.needsUpdate = true;
        this.atlas = tAtlas;

        // const data = wad.flatTextureData('CEIL3_5')
        // const data = wad.flatTextureData('FLOOR4_8')
        const texture = new DataTexture(atlasTexture, tSize, tSize)
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.magFilter = NearestFilter;
        // texture.flipY = true;
        texture.needsUpdate = true;
        texture.colorSpace = SRGBColorSpace;
        this.texture = texture;
    }

    textureData(textureName: string): [number, Picture] {
        let index = this.textures.findIndex(e => e[0] === textureName);
        if (index === -1) {
            console.warn('unmapped texture', textureName);
        }
        return [index / this.textures.length, this.textures[index][1]];
    }
}