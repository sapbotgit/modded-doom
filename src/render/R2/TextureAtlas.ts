import { DataTexture, FloatType, NearestFilter, RepeatWrapping, SRGBColorSpace } from "three";
import type { DoomWad, Picture } from "../../doom";

export class TextureAtlas {
    readonly atlas: DataTexture;
    readonly texture: DataTexture;
    private textures = new Map<string, [number, Picture]>();
    private flats = new Map<string, [number, Picture]>();
    private flatStart = 0;

    get numTextures() { return this.atlas.image.width; }

    constructor(wad: DoomWad, tSize: number) {
        const textures = wad.texturesNames()
            .map<[string, Picture]>(e => [e, wad.wallTextureData(e)])
            .sort((a, b) => b[1].height - a[1].height);
        textures.forEach((e, i) => this.textures.set(e[0], [i, e[1]]));
        this.flatStart = textures.length;

        const atlasTexture = new Uint8ClampedArray(tSize * tSize * 4).fill(0);
        const flats = wad.flatsNames().map<[string, Picture]>(e => [e, wad.flatTextureData(e)]);
        flats.forEach((e, i) => this.flats.set(e[0], [i + this.flatStart, e[1]]));

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
            if (off.y > tSize) {
                console.warn('atlas is full', textures[i][0]);
                continue;
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
            if (off.y > tSize) {
                console.warn('atlas is full', flats[i][0]);
                continue;
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
        let data = this.textures.get(name);
        if (!data) {
            console.warn('unmapped texture', name);
        }
        return data; // TODO: default texture?
    }

    flatTexture(name: string): [number, Picture] {
        let data = this.flats.get(name);
        if (!data) {
            console.warn('unmapped flat', name);
        }
        return data; // TODO: default texture?
    }
}