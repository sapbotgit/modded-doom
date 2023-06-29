import { DataTexture, DisplayP3ColorSpace, LinearSRGBColorSpace, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import type { DoomWad } from "../doomwad";

// all flats (floors/ceilings) are 64px
const flatRepeat = 1 / 64;

export class MapTextures {
    private cache = new Map<string, Texture>();

    constructor(readonly wad: DoomWad) {}

    get(name: string, type: 'wall' | 'flat' | 'sprite') {
        const cacheKey = type[0] + name;
        let texture = this.cache.get(cacheKey);
        if (texture === undefined && name) {
            const loadFn = type === 'wall' ? 'wallTextureData' :
                type === 'flat' ? 'flatTextureData' :
                'spriteTextureData';
            const data = this.wad[loadFn](name);
            if (typeof data === 'object') {
                texture = new DataTexture(data.buffer, data.width, data.height)
                texture.wrapS = RepeatWrapping;
                texture.wrapT = RepeatWrapping;
                texture.flipY = true;
                texture.needsUpdate = true;
                texture.colorSpace = SRGBColorSpace;
                texture.userData = {
                    width: data.width,
                    height: data.height,
                    invWidth: 1 / data.width,
                    invHeight: 1 / data.height,
                }

                if (type === 'flat') {
                    // flats don't need extra positioning (because doom floors are aligned to grid)
                    // so configure the texture here so we don't need to clone to set offset
                    texture.repeat.set(flatRepeat, flatRepeat);
                }
            } else {
                texture = null;
            }
            this.cache.set(cacheKey, texture);
        }
        return texture;
    }
}
