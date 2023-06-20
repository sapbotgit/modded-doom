import { DataTexture, RepeatWrapping, type Texture } from "three";
import type { DoomWad, LineDef, SideDef } from "../doomwad";

export class MapTextures {
    private cache = new Map<string, Texture>();

    constructor(readonly wad: DoomWad) {}

    get(name: string) {
        let texture = this.cache.get(name);
        if (texture === undefined && name) {
            const data = this.wad.textureData(name);
            if (typeof data === 'object') {
                texture = new DataTexture(data.buffer, data.width, data.height)
                texture.wrapS = RepeatWrapping;
                texture.wrapT = RepeatWrapping;
                texture.flipY = true;
                texture.needsUpdate = true;
            } else {
                texture = null;
            }
            this.cache.set(name, texture);
        }
        return texture;
    }

    position(texture: Texture, width: number, height: number, ld: LineDef, sd: SideDef, type: 'upper' | 'lower' | 'middle') {
        const texture2 = texture.clone();

        const invTextureWidth = 1 / texture2.source.data.width;
        const invTextureHeight = 1 / texture2.source.data.height;
        texture2.repeat.set(width * invTextureWidth, height * invTextureHeight);

        //TODO: a wall in E1M1's ooze room isn't aligned... not sure why

        // texture alignment is complex https://doomwiki.org/wiki/Texture_alignment
        // threejs uses 0,0 in bottom left but doom uses 0,0 for top left so we by default
        // "peg" the corner to the top left by offsetting by height
        let pegging = -height;
        if (ld.flags & 0x0004) {
            // two-sided
            if (type === 'lower' && (ld.flags & 0x0010)) {
                // unpegged so subtract higher floor from ceiling to get real offset
                pegging -= Math.max(ld.left.sector.zCeil, ld.right.sector.zCeil)
                    - Math.max(ld.left.sector.zFloor, ld.right.sector.zFloor);
            } else if (type === 'upper' && !(ld.flags & 0x0008)) {
                pegging = 0;
            }
        } else if (ld.flags & 0x0010) {
            // peg to floor (bottom left)
            pegging = 0;
        }
        const yOffset = -sd.yOffset + pegging;
        texture2.offset.set(sd.xOffset * invTextureWidth, yOffset * invTextureHeight)
        return texture2;
    }
}
