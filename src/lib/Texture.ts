import { ClampToEdgeWrapping, Color, DataTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import type { DoomWad } from "../doom";
import { sineIn } from 'svelte/easing';

// all flats (floors/ceilings) are 64px
const flatRepeat = 1 / 64;

export class MapTextures {
    private cache = new Map<string, Texture>();
    private lightCache = new Map<number, Color>;

    constructor(readonly wad: DoomWad) {
        const maxLight = 255;
        for (let i = 0; i < maxLight + 1; i++) {
            // scale light using a curve to make it look more like doom
            const light = Math.floor(sineIn(i / maxLight) * maxLight);
            this.lightCache.set(i, new Color(light | light << 8 | light << 16));
        }
    }

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
                    xOffset: data.xOffset,
                    yOffset: data.yOffset,
                    invWidth: 1 / data.width,
                    invHeight: 1 / data.height,
                }

                if (type === 'sprite') {
                    texture.wrapS = ClampToEdgeWrapping;
                    texture.wrapT = ClampToEdgeWrapping;
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
        if (!texture) {
            console.warn('missing texture', name, type)
        }
        return texture;
    }

    // TODO: find a better place for this
    lightColor(light: number) {
        return this.lightCache.get(Math.max(0, Math.min(255, light)));
    }
}
