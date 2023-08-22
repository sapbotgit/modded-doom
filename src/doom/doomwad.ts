//
// Adapted from pieces of https://github.com/jmickle66666666/wad-js/blob/develop/src/wad/mapdata.js
//

import KaitaiStream from 'kaitai-struct/KaitaiStream';
import DoomWadRaw from './doom-wad.ksy.ts';
import { DoomMap } from './Map.ts';

type RGB = string;
type Palette = RGB[];

interface SpriteFrame {
    name: string;
    mirror: boolean;
}

export class DoomWad {
    private mapIndex = new Map<string, number>();
    palettes: Palette[] = [];
    raw: any[];

    private switchWalls: string[][];
    private animatedFlats: string[][];
    private animatedWalls: string[][];

    get mapNames() { return [...this.mapIndex.keys()]; }

    constructor(wad: ArrayBuffer) {
        const data = new DoomWadRaw(new KaitaiStream(wad), null, null);
        this.raw = data.index;

        // https://doomwiki.org/wiki/PLAYPAL
        const playpal = this.lumpByName('PLAYPAL');
        if (playpal) {
            for (let i = 0; i < 14; i++) {
                const palette = [];
                for (let j = 0; j < 256; j++) {
                    const r = playpal.contents[i * 768 + j * 3 + 0];
                    const g = playpal.contents[i * 768 + j * 3 + 1];
                    const b = playpal.contents[i * 768 + j * 3 + 2];
                    palette.push("#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1));
                }
                this.palettes.push(palette);
            }
        }

        for (let i = 0; i < this.raw.length; i++) {
            if (isMap(this.raw[i])) {
                this.mapIndex.set(this.raw[i].name, i);
            }
        }

        // list of animated flats https://doomwiki.org/wiki/Animated_flat
        const allFlats = this.flatsNames();
        this.animatedFlats = [
            { first: 'NUKAGE1', last: 'NUKAGE3' },
            { first: 'FWATER1', last: 'FWATER4' },
            { first: 'SWATER1', last: 'SWATER4' },
            { first: 'LAVA1', last: 'LAVA4' },
            { first: 'BLOOD1', last: 'BLOOD3' },
            { first: 'RROCK05', last: 'RROCK08' },
            { first: 'SLIME01', last: 'SLIME04' },
            { first: 'SLIME05', last: 'SLIME08' },
            { first: 'SLIME09', last: 'SLIME12' },
        ].map(e => {
            const first = allFlats.indexOf(e.first);
            const last = allFlats.indexOf(e.last);
            return allFlats.slice(first, last + 1);
        }).filter(e => e.length);

        // list of animated walls https://doomwiki.org/wiki/Animated_wall
        const allTextures = this.texturesNames();
        this.animatedWalls = [
            { first: 'BLODGR1', last: 'BLODGR4' },
            { first: 'BLODRIP1', last: 'BLODRIP4' },
            { first: 'FIREBLU1', last: 'FIREBLU2' },
            { first: 'FIRELAV3', last: 'FIRELAVA' },
            { first: 'FIREMAG1', last: 'FIREMAG3' },
            { first: 'FIREWALA', last: 'FIREWALL' },
            { first: 'GSTFONT1', last: 'GSTFONT3' },
            { first: 'ROCKRED1', last: 'ROCKRED3' },
            { first: 'SLADRIP1', last: 'SLADRIP3' },
            { first: 'BFALL1', last: 'BFALL4' },
            { first: 'SFALL1', last: 'SFALL4' },
            { first: 'WFALL1', last: 'WFALL4' },
            { first: 'DBRAIN1', last: 'DBRAIN4' },
        ].map(e => {
            const first = allTextures.indexOf(e.first);
            const last = allTextures.indexOf(e.last);
            return allTextures.slice(first, last + 1);
        }).filter(e => e.length);

        // Wall switches https://doomwiki.org/wiki/Switch
        this.switchWalls = [
            ['SW1BRCOM', 'SW2BRCOM'],
            ['SW1BRN1', 'SW2BRN1'],
            ['SW1BRN2', 'SW2BRN2'],
            ['SW1BRNGN', 'SW2BRNGN'],
            ['SW1BROWN', 'SW2BROWN'],
            ['SW1COMM', 'SW2COMM'],
            ['SW1COMP', 'SW2COMP'],
            ['SW1DIRT', 'SW2DIRT'],
            ['SW1EXIT', 'SW2EXIT'],
            ['SW1GRAY', 'SW2GRAY'],
            ['SW1GRAY1', 'SW2GRAY1'],
            ['SW1METAL', 'SW2METAL'],
            ['SW1PIPE', 'SW2PIPE'],
            ['SW1SLAD', 'SW2SLAD'],
            ['SW1STARG', 'SW2STARG'],
            ['SW1STON1', 'SW2STON1'],
            ['SW1STON2', 'SW2STON2'],
            ['SW1STONE', 'SW2STONE'],
            ['SW1STRTN', 'SW2STRTN'],
            ['SW1BLUE', 'SW2BLUE'],
            ['SW1CMT', 'SW2CMT'],
            ['SW1GARG', 'SW2GARG'],
            ['SW1GSTON', 'SW2GSTON'],
            ['SW1HOT', 'SW2HOT'],
            ['SW1LION', 'SW2LION'],
            ['SW1SATYR', 'SW2SATYR'],
            ['SW1SKIN', 'SW2SKIN'],
            ['SW1VINE', 'SW2VINE'],
            ['SW1WOOD', 'SW2WOOD'],
            ['SW1PANEL', 'SW2PANEL'],
            ['SW1ROCK', 'SW2ROCK'],
            ['SW1MET2', 'SW2MET2'],
            ['SW1WDMET', 'SW2WDMET'],
            ['SW1BRIK', 'SW2BRIK'],
            ['SW1MOD1', 'SW2MOD1'],
            ['SW1ZIM', 'SW2ZIM'],
            ['SW1STON6', 'SW2STON6'],
            ['SW1TEK', 'SW2TEK'],
            ['SW1MARB', 'SW2MARB'],
            ['SW1SKULL', 'SW2SKULL'],
        ].map(e => {
            const i1 = allTextures.indexOf(e[0]);
            const i2 = allTextures.indexOf(e[1]);
            return i1 === -1 || i2 === -1 ? null : e;
        }).filter(e => e);
    }

    readMap(name: string) {
        const index = this.mapIndex.get(name)
        return new DoomMap(this, index);
    }

    switchToggle(name: string): string | undefined {
        for (const [sw1, sw2] of this.switchWalls) {
            if (sw1 === name) {
                return sw2;
            }
            if (sw2 === name) {
                return sw1;
            }
        }
    }

    animatedWallInfo(name: string): [number, string[]] {
        for (const frames of this.animatedWalls) {
            let index = frames.indexOf(name);
            if (index !== -1) {
                return [index, frames];
            }
        }
        return null;
    }

    texturesNames(): string[] {
        const texture1 = this.lumpByName('TEXTURE1').contents.textures;
        // not all wads have texture2? (looking at you plutonia...)
        const texture2 = this.lumpByName('TEXTURE2')?.contents.textures ?? [];
        return [
            ...texture1.map(e => e.body.name),
            ...texture2.map(e => e.body.name),
        ];
    }

    animatedFlatInfo(name: string): [number, string[]] {
        for (const frames of this.animatedFlats) {
            let index = frames.indexOf(name);
            if (index !== -1) {
                return [index, frames];
            }
        }
        return null;
    }

    flatsNames(): string[] {
        const fStartIndex = this.raw.findIndex(e => e.name === 'F_START');
        const fEndIndex = this.raw.findIndex(e => e.name === 'F_END');
        return this.raw.slice(fStartIndex, fEndIndex + 1)
            .filter(e => !e.name.endsWith('_START') && !e.name.endsWith('_END'))
            .map(e => e.name);
    }

    wallTextureData(name: string) {
        const uname = name.toUpperCase();
        // use patches first because sometimes flats and patches have the same name
        // https://doomwiki.org/wiki/Flat_and_texture_mixing
        // a better approach would be to use F_START/P_START markers

        // texture from patches
        const texture1 = this.lumpByName('TEXTURE1').contents.textures;
        // not all wads have texture2? (looking at you plutonia...)
        const texture2 = this.lumpByName('TEXTURE2')?.contents.textures ?? [];
        const texture =
            texture1.find(e => e.body.name === uname) ??
            texture2.find(e => e.body.name === uname);

        const pnames = this.lumpByName('PNAMES').contents.names.map(e => e.toUpperCase());
        if (texture) {
            return this.assemblePatchGraphic(pnames, texture.body)
        }

        const data = this.lumpByName(uname);
        if (data) {
            return this.textureGraphic(data);
        }
        console.warn('missing texture:' + uname)
        return null;
    }

    spriteFrames(name: string): SpriteFrame[][] {
        // TODO: cache results?
        const uname = name.toUpperCase();
        const sStartIndex = this.raw.findIndex(e => e.name === 'S_START');
        const sEndIndex = this.raw.findIndex(e => e.name === 'S_END');
        const sprites = this.raw.filter((lump, idx) => lump.name.startsWith(uname) && idx > sStartIndex && idx < sEndIndex).map(lump => lump.name);
        const frames: (SpriteFrame & { frame: number, rotation: number })[] = [];
        for (const spriteName of sprites) {
            let frame = spriteName.charCodeAt(4) - 65;
            let rotation = spriteName.charCodeAt(5) - 48;

            frames.push({ frame, rotation, name: spriteName, mirror: false });
            if (rotation === 0) {
                continue;
            }

            if (spriteName.length === 8) {
                let frame = spriteName.charCodeAt(6) - 65;
                let rotation = spriteName.charCodeAt(7) - 48;
                frames.push({ frame, rotation, name: spriteName, mirror: true });
            }
        }

        const result: SpriteFrame[][] = [];
        for (const frame of frames.map(e => e.frame)) {
            result[frame] = frames.filter(e => e.frame === frame).sort((a, b) => a.rotation - b.rotation);
        }
        return result;
    }

    spriteTextureData(name: string) {
        const uname = name.toUpperCase();
        const fStartIndex = this.raw.findIndex(e => e.name === 'S_START');
        const fEndIndex = this.raw.findIndex(e => e.name === 'S_END');

        const data = this.lumpByName(uname);
        const idx = this.raw.indexOf(data);
        if (idx > fStartIndex && idx < fEndIndex) {
            return this.textureGraphic(data);
        }

        console.warn('missing sprite:' + uname)
        return null;
    }

    flatTextureData(name: string) {
        const uname = name.toUpperCase();
        const fStartIndex = this.raw.findIndex(e => e.name === 'F_START');
        const fEndIndex = this.raw.findIndex(e => e.name === 'F_END');

        const data = this.lumpByName(uname);
        const idx = this.raw.indexOf(data);
        if (idx > fStartIndex && idx < fEndIndex) {
            return this.readFlat(data);
        }

        console.warn('missing flat:' + uname)
        return null;
    }

    private lumpByName(name: string) {
        return this.raw.find(p => p.name === name);
    }

    private assemblePatchGraphic(pnames: string[], textureData: any) {
        const { width, height, patches } = textureData;

        const buffer = new Uint8ClampedArray(4 * width * height);
        for (const patch of patches) {
            const pname = pnames[patch.patchId];
            const lump = this.lumpByName(pname);
            const pic = this.doomPicture(lump);
            if (typeof pic === 'string') {
                console.warn('invalid patch', patch, pname)
                continue;
            }

            for (let i = 0; i < pic.width; i++) {
                for(let j = 0; j < pic.height; j++) {
                    const u = patch.originX + i;
                    const v = patch.originY + j;
                    if (u < 0 || u >= width || v < 0 || v >= height) {
                        continue;
                    }
                    const patchIdx = i + j * pic.width;
                    const colorIdx = pic.data[patchIdx];
                    const idx = 4 * (u + v * width);
                    if (colorIdx !== -1) {
                        const c = hexToRgb(this.palettes[0][colorIdx]);
                        buffer[idx + 0] = c.r;
                        buffer[idx + 1] = c.g;
                        buffer[idx + 2] = c.b;
                        buffer[idx + 3] = 255;
                    }
                }
            }
        }

        return { width, height, buffer, xOffset: 0, yOffset: 0 };
    }

    public graphic(name: string) {
        const uname = name.toUpperCase();
        const lump = this.lumpByName(uname);
        if (!lump) {
            return '';
        }
        return this.textureGraphic(lump);
    }

    private textureGraphic(lumpData: any) {
        const pic = this.doomPicture(lumpData);
        if (typeof pic === 'string') {
            return pic;
        }
        const { width, height, data, xOffset, yOffset } = pic;

        let buffer = new Uint8ClampedArray(4 * width * height);
        var size = width * height;
        for (var i = 0; i < size; i++) {
            if (data[i] === -1) {
                buffer[i * 4 + 0] = 0;
                buffer[i * 4 + 1] = 0;
                buffer[i * 4 + 2] = 0;
                buffer[i * 4 + 3] = 0;
            } else {
                let col = hexToRgb(this.palettes[0][data[i]]);
                buffer[i * 4 + 0] = col.r;
                buffer[i * 4 + 1] = col.g;
                buffer[i * 4 + 2] = col.b;
                buffer[i * 4 + 3] = 255;
            }
        }

        return { width, height, buffer, xOffset, yOffset };
    }

    private readFlat(lump: any) {
        const buff = lump.contents as Uint8Array;
        let dv = new DataView(buff.buffer.slice(buff.byteOffset, buff.byteLength + buff.byteOffset));
        const width = 64;
        const height = 64;
        const size = width * height;

        let data = [];
        for (var j = 0; j < size; j++) {
            data.push(dv.getUint8(j));
        }

        let buffer = new Uint8ClampedArray(4 * width * height);
        for (var i = 0; i < size; i++) {
            let col = hexToRgb(this.palettes[0][data[i]]);
            buffer[i * 4 + 0] = col.r;
            buffer[i * 4 + 1] = col.g;
            buffer[i * 4 + 2] = col.b;
            buffer[i * 4 + 3] = 255;
        }

        return { width, height, buffer, xOffset: 0, yOffset: 0 };
    }

    private doomPicture(lump: any) {
        // https://doomwiki.org/wiki/Picture_format
        // Straight outta https://github.com/jmickle66666666/wad-js/blob/develop/src/wad/graphic.js
        // (with some cleanup)

        // We can do better... https://stackoverflow.com/questions/51452398
        const buff = lump.contents as Uint8Array;
        let dv = new DataView(buff.buffer.slice(buff.byteOffset, buff.byteLength + buff.byteOffset));

        // let width = lumpData.contents[1] << 4 | lumpData.contents[0];
        // let height = lumpData.contents[3] << 8 | lumpData.contents[2];
        let width = dv.getUint16(0, true);
        let height = dv.getUint16(2, true);
        // these seem to only be used for sprites
        let xOffset = dv.getInt16(4, true);
        let yOffset = dv.getInt16(6, true);
        if (width > 2048 || height > 2048) {
            console.warn('bad pic?',lump, width, height)
            return ''
        }

        let data = [];
        for (let i = 0; i < width; i++) {
            for (let j = 0; j < height; j++) {
                //-1 for transparency
                data.push(-1);
            }
        }

        let columns = [];
        for (let i = 0; i < width; i++) {
            columns[i] = dv.getUint32(8 + (i * 4), true);
        }

        let position = 0;
        let pixelCount = 0;
        for (let i = 0; i < width; i++) {
            position = columns[i];

            let rowStart = 0;
            while (rowStart !== 255) {
                rowStart = dv.getUint8(position);
                position += 1;

                if (rowStart === 255) break;

                pixelCount = dv.getUint8(position);
                position += 2;

                for (let j = 0; j < pixelCount; j++) {
                    data[((rowStart + j) * width) + i] = dv.getUint8(position);
                    position += 1;
                }
                position += 1;
            }
        }

        return { width, height, xOffset, yOffset, data };
    }
}

// https://github.com/jmickle66666666/wad-js/blob/develop/src/wad/util.js
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

const isMap = (item) =>
    /^MAP\d\d$/.test(item.name) ||
    /^E\dM\d$/.test(item.name);
