//
// Adapted from pieces of https://github.com/jmickle66666666/wad-js/blob/develop/src/wad/mapdata.js
//

import KaitaiStream from 'kaitai-struct/KaitaiStream';
import DoomWadRaw from './doom-wad.ksy.ts';
import { MapData } from '../map-data.ts';
import { type Picture, type Palette, PatchPicture, LumpPicture, FlatPicture } from './picture.ts';
import { Color } from 'three';

interface SpriteFrame {
    name: string;
    mirror: boolean;
}

// TODO: support pwads
export class DoomWad {
    private spriteFrameTable = new Map<string, SpriteFrame[][]>();
    private mapIndex = new Map<string, number>();
    readonly palettes: Palette[] = [];
    raw: any[];
    private textureLumps: any[];
    private flatLumps: any[];
    private spriteLumps: any[];
    private pnames: string[];

    private switchWalls: string[][];
    private animatedFlats: string[][];
    private animatedWalls: string[][];

    get mapNames() { return [...this.mapIndex.keys()]; }

    constructor(wad: ArrayBuffer) {
        const data = new DoomWadRaw(new KaitaiStream(wad), null, null);
        this.raw = data.index;

        this.pnames = this.lumpByName('PNAMES').contents.names.map(e => e.toUpperCase());

        const texture1 = this.lumpByName('TEXTURE1').contents.textures;
        // not all wads have texture2? (looking at you plutonia...)
        const texture2 = this.lumpByName('TEXTURE2')?.contents.textures ?? [];
        this.textureLumps = [...texture1, ...texture2];

        const sStartIndex = this.raw.findIndex(e => e.name === 'S_START');
        const sEndIndex = this.raw.findIndex(e => e.name === 'S_END');
        this.spriteLumps = this.raw.filter((e, i) => i > sStartIndex && i < sEndIndex);

        const fStartIndex = this.raw.findIndex(e => e.name === 'F_START');
        const fEndIndex = this.raw.findIndex(e => e.name === 'F_END');
        this.flatLumps = this.raw.slice(fStartIndex, fEndIndex + 1)
            .filter(e => !e.name.endsWith('_START') && !e.name.endsWith('_END'));

        // https://doomwiki.org/wiki/PLAYPAL
        const playpal = this.lumpByName('PLAYPAL');
        if (playpal) {
            for (let i = 0; i < 14; i++) {
                const palette = [];
                for (let j = 0; j < 256; j++) {
                    const r = playpal.contents[i * 768 + j * 3 + 0];
                    const g = playpal.contents[i * 768 + j * 3 + 1];
                    const b = playpal.contents[i * 768 + j * 3 + 2];
                    palette.push(new Color(r, g, b));
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
        return index !== undefined ? new MapData(this, index) : null;
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

    animatedWallInfo(name: string) {
        return this.filterAnimationInfo(name, this.animatedWalls);
    }

    animatedFlatInfo(name: string) {
        return this.filterAnimationInfo(name, this.animatedFlats);
    }

    private filterAnimationInfo(name: string, info: string[][]): [number, string[]] {
        for (const frames of info) {
            let index = frames.indexOf(name);
            if (index !== -1) {
                return [index, frames];
            }
        }
        return null;
    }

    texturesNames(): string[] {
        return this.textureLumps.map(e => e.body.name);
    }

    flatsNames(): string[] {
        return this.flatLumps.map(e => e.name);
    }

    wallTextureData(name: string) {
        if (!name) {
            return null;
        }
        const uname = name.toUpperCase();
        // use patches first because sometimes flats and patches have the same name
        // https://doomwiki.org/wiki/Flat_and_texture_mixing
        // a better approach would be to use F_START/P_START markers

        // try a texture from patches first
        const texture = this.textureLumps.find(e => e.body.name === uname);
        if (texture) {
            const { width, height, patches } = texture.body;
            const pics = patches.map(({ patchId, originX, originY }) => {
                const pname = this.pnames[patchId];
                const pic = this.graphic(pname);
                if (!pic) {
                    console.warn('invalid patch', patchId, pname)
                    return null;
                }
                return { pic, originX, originY };
            }).filter(e => e);
            return new PatchPicture(width, height, pics);
        }

        // not patch, try a plan lump with that name
        const pic = this.graphic(uname);
        if (pic) {
            return pic;
        }
        console.warn('missing texture:' + uname)
        return null;
    }

    spriteFrames(name: string): SpriteFrame[][] {
        const uname = name.toUpperCase();
        if (this.spriteFrameTable.has(uname)) {
            return this.spriteFrameTable.get(uname)
        }

        const sprites = this.spriteLumps.filter(lump => lump.name.startsWith(uname));
        const frames: (SpriteFrame & { frame: number, rotation: number })[] = [];
        for (const lump of sprites) {
            const spriteName = lump.name;
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
        this.spriteFrameTable.set(uname, result);
        return result;
    }

    spriteTextureData(name: string): Picture {
        const uname = name.toUpperCase();
        const data = this.spriteLumps.find(e => e.name === uname);
        if (data) {
            return new LumpPicture(data, this.palettes[0]);
        }
        console.warn('missing sprite:' + uname)
        return null;
    }

    flatTextureData(name: string): Picture {
        const uname = name.toUpperCase();
        const data = this.flatLumps.find(e => e.name === uname);
        if (data) {
            return new FlatPicture(data, this.palettes[0]);
        }
        console.warn('missing flat:' + uname)
        return null;
    }

    private lumpByName(name: string) {
        return this.raw.find(p => p.name === name);
    }

    graphic(name: string): Picture {
        const uname = name.toUpperCase();
        const lump = this.lumpByName(uname);
        if (!lump) {
            return null;
        }
        return new LumpPicture(lump, this.palettes[0]);
    }
}

const isMap = (item) =>
    /^MAP\d\d$/.test(item.name) ||
    /^E\dM\d$/.test(item.name);
