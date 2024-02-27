import KaitaiStream from 'kaitai-struct/KaitaiStream';
import DoomWadRaw from './doom-wad.ksy.ts';
import { MapData } from '../map-data.ts';
import { type Picture, type Palette, PatchPicture, LumpPicture, FlatPicture } from './picture.ts';
import { Color } from 'three';

interface SpriteFrame {
    name: string;
    mirror: boolean;
}

export class WadFile {
    raw: any[];

    constructor(readonly name: string, buffer: ArrayBuffer) {
        const data = new DoomWadRaw(new KaitaiStream(buffer), null, null);
        this.raw = data.index;
    }

    lumpByName(name: string) {
        return this.raw.find(p => p.name === name);
    }
}

export class DoomWad {
    private spriteFrameTable = new Map<string, SpriteFrame[][]>();
    readonly palettes: Palette[] = [];
    private textureLumps: any[] = [];
    private flatLumps: any[] = [];
    private spriteLumps: any[] = [];
    private mapLumps = new Map<string, any[]>();
    private pnames: string[];

    private switchWalls: string[][];
    private animatedFlats: string[][];
    private animatedWalls: string[][];

    get mapNames() { return [...this.mapLumps.keys()]; }
    get isIWAD() {
        // this is a _very_ cheap (and incorrect) version of the check from https://doomwiki.org/wiki/IWAD.
        // It will probably cause problems and need to be improved
        return Boolean(this.pnames.length && this.textureLumps.length && this.spriteLumps.length && this.flatLumps.length
            && this.palettes.length && this.animatedFlats.length && this.animatedWalls.length && this.switchWalls.length
            && this.mapNames.length && this.lumpByName('ENDOOM') && this.lumpByName('COLORMAP'));
    }

    constructor(readonly name: string, private wads: WadFile[]) {
        // use maps so that the last wad wins
        const textures = new Map<string, any>();
        const sprites = new Map<string, any>();
        const flats = new Map<string, any>();
        const patches = new Set<string>();
        for (const wad of wads) {
            const pnames = wad.lumpByName('PNAMES')?.contents.names.map(e => e.toUpperCase()) ?? [];
            pnames.forEach(name => patches.add(name));

            const texture1 = wad.lumpByName('TEXTURE1')?.contents.textures ?? [];
            const texture2 = wad.lumpByName('TEXTURE2')?.contents.textures ?? [];
            [...texture1, ...texture2].forEach(lump => textures.set(lump.body.name, lump));

            const sStartIndex = wad.raw.findIndex(e => e.name === 'S_START' || e.name === 'SS_START');
            const sEndIndex = wad.raw.findIndex(e => e.name === 'S_END' || e.name === 'SS_END');
            for (let i = sStartIndex; i < sEndIndex; i++) {
                if (!wad.raw[i].name.endsWith('_START') && !wad.raw[i].name.endsWith('_END')) {
                    sprites.set(wad.raw[i].name, wad.raw[i]);
                }
            }

            const fStartIndex = wad.raw.findIndex(e => e.name === 'F_START' || e.name === 'FF_START');
            const fEndIndex = wad.raw.findIndex(e => e.name === 'F_END' || e.name === 'FF_END');
            for (let i = fStartIndex; i < fEndIndex; i++) {
                if (!wad.raw[i].name.endsWith('_START') && !wad.raw[i].name.endsWith('_END')) {
                    flats.set(wad.raw[i].name, wad.raw[i]);
                }
            }

            for (let i = 0; i < wad.raw.length; i++) {
                if (isMap(wad.raw[i])) {
                    this.mapLumps.set(wad.raw[i].name, wad.raw.slice(i, i + 11));
                }
            }
        }

        this.pnames = [...patches];
        this.textureLumps = [...textures.values()];
        this.spriteLumps = [...sprites.values()];
        this.flatLumps = [...flats.values()];

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
        const lumps = this.mapLumps.get(name)
        return lumps ? new MapData(this, lumps) : null;
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

    graphic(name: string): Picture {
        const uname = name.toUpperCase();
        const lump = this.lumpByName(uname);
        if (!lump) {
            return null;
        }
        return new LumpPicture(lump, this.palettes[0]);
    }

    lumpByName(name: string) {
        // go from last wad to first because the last wad lump wins
        for (let i = this.wads.length - 1; i >= 0; i--) {
            const lump = this.wads[i].lumpByName(name);
            if (lump) {
                return lump;
            }
        }
        console.warn('unknown lump', name);
    }
}

const isMap = (item) =>
    /^MAP\d\d$/.test(item.name) ||
    /^E\dM\d$/.test(item.name);
