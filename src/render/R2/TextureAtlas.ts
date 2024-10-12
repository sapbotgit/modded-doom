import { DataTexture, FloatType, NearestFilter, RepeatWrapping, SRGBColorSpace } from "three";
import type { DoomWad, Picture } from "../../doom";

export class TextureAtlas {
    readonly atlas: DataTexture;
    readonly texture: DataTexture;
    private textures: [string, Picture][];
    private flats: [string, Picture][];
    private flatStart = 0;

    constructor(wad: DoomWad, tSize: number) {
        const textures = wad.texturesNames()
            .map<[string, Picture]>(e => [e, wad.wallTextureData(e)])
            .sort((a, b) => b[1].height - a[1].height);
        this.textures = textures;

        const atlasTexture = new Uint8ClampedArray(tSize * tSize * 4);
        const flats = wad.flatsNames().map<[string, Picture]>(e => [e, wad.flatTextureData(e)]);
        this.flats = flats;
        const atlasMap = new Float32Array((textures.length + flats.length) * 4);
        this.flatStart = textures.length;

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

            atlasMap[0 + (i + this.flatStart) * 4] = off.x / tSize;
            atlasMap[1 + (i + this.flatStart) * 4] = off.y / tSize;
            off.x += 64;
            atlasMap[2 + (i + this.flatStart) * 4] = off.x / tSize;
            atlasMap[3 + (i + this.flatStart) * 4] = (off.y + 64) / tSize;
        }

        const tAtlas = new DataTexture(atlasMap, flats.length + textures.length);
        tAtlas.type = FloatType;
        tAtlas.needsUpdate = true;
        this.atlas = tAtlas;

        const texture = new DataTexture(atlasTexture, tSize, tSize)
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.magFilter = NearestFilter;
        texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;
        this.texture = texture;
    }

    wallTexture(name: string): [number, Picture] {
        let index = this.textures.findIndex(e => e[0] === name);
        if (index === -1) {
            console.warn('unmapped texture', name);
        }
        return [index / this.atlas.image.width, this.textures[index][1]];
    }

    flatTexture(name: string): [number, Picture] {
        let index = this.flats.findIndex(e => e[0] === name);
        if (index === -1) {
            console.warn('unmapped flat', name);
        }
        return [(index + this.flatStart) / this.atlas.image.width, this.flats[index][1]];
    }
}