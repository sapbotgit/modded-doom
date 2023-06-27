//
// Heavily adapted from https://github.com/jmickle66666666/wad-js/blob/develop/src/wad/mapdata.js
//

import KaitaiStream from 'kaitai-struct/KaitaiStream';
import DoomWadRaw from './doom-wad.ksy.js';
import { centerSort, intersectionPoint, signedLineDistance } from './lib/Math.js';
import { readable, writable, type Writable } from 'svelte/store';

type ThingType = number;

export interface Thing {
    x: number;
    y: number;
    angle: number;
    type: ThingType;
    flags: number;
}

export interface LineDef {
    v1: Vertex;
    v2: Vertex;
    flags: number;
    special: number;
    tag: number;
    right?: SideDef;
    left?: SideDef;
    // derived
    xOffset?: Writable<number>;
}
const toLineDef = (ld: any, vertexes: Vertex[], sidedefs: SideDef[]): LineDef => ({
    v1: vertexes[ld.vertexStartIdx],
    v2: vertexes[ld.vertexEndIdx],
    left: sidedefs[ld.sidedefLeftIdx],
    right: sidedefs[ld.sidedefRightIdx],
    tag: ld.sectorTag,
    special: ld.lineType,
    flags: ld.flags,
});

export interface SideDef {
    xOffset: number;
    yOffset: number;
    sector: Sector;
    upper: Writable<string>;
    lower: Writable<string>;
    middle: Writable<string>;
}
const toSideDef = (sd: any, sectors: Sector[]): SideDef => ({
    xOffset: sd.offsetX,
    yOffset: sd.offsetY,
    sector: sectors[sd.sectorId],
    lower: writable(fixTextureName(sd.lowerTextureName)),
    middle: writable(fixTextureName(sd.normalTextureName)),
    upper: writable(fixTextureName(sd.upperTextureName)),
});

function fixTextureName(name: string) {
    return !name || name.startsWith('-') ? undefined : name.split('\u0000')[0];
}

export interface Vertex {
    x: number;
    y: number;
}

interface Seg {
    vx1: Vertex;
    vx2: Vertex;
    angle: number;
    linedef: LineDef;
    direction: number;
    offset: number;
}
const toSeg = (item: any, vertexes: Vertex[], linedefs: LineDef[]): Seg => ({
    vx1: vertexes[item.vertexStart],
    vx2: vertexes[item.vertexEnd],
    angle: item.angle,
    linedef: linedefs[item.linedef],
    direction: item.direction,
    offset: item.offset,
});

export interface Sector {
    tag: number;
    type: number;
    raw: any;
    zFloor: Writable<number>;
    zCeil: Writable<number>;
    light: Writable<number>;
    floorFlat: Writable<string>;
    ceilFlat: Writable<string>;
}
const toSector = (sd: any): Sector => ({
    raw: sd,
    tag: sd.tag,
    type: sd.specialType,
    zFloor: writable(sd.floorZ),
    zCeil: writable(sd.ceilZ),
    light: writable(sd.light),
    floorFlat: writable(fixTextureName(sd.floorFlat)),
    ceilFlat: writable(fixTextureName(sd.ceilFlat)),
});

export interface SubSector {
    sector: Sector;
    segs: Seg[];
}
const toSubSector = (item: any, segs: Seg[]): SubSector => ({
    sector: segs[item.firstSeg].direction ? segs[item.firstSeg].linedef.left.sector : segs[item.firstSeg].linedef.right.sector,
    segs: segs.slice(item.firstSeg, item.firstSeg + item.count),
});

interface NodeBounds {
    top: number;
    left: number;
    bottom: number;
    right: number;
}
export interface TreeNode {
    v1: Vertex;
    v2: Vertex;
    boundsRight: NodeBounds;
    boundsLeft: NodeBounds;
    childRight: TreeNode | SubSector;
    childLeft: TreeNode | SubSector;
}
const toNode = (item: any): TreeNode => ({
    v1: { x: item.xStart, y: item.yStart },
    v2: { x: item.xStart + item.xChange, y: item.yStart + item.yChange },
    childRight: item.rightChild,
    childLeft: item.leftChild,
    boundsRight: item.rightBounds,
    boundsLeft: item.leftBounds,
});
function assignChild(child: TreeNode | SubSector, nodes: TreeNode[], ssector: SubSector[]) {
    let idx = (child as any) as number;
    return (idx & 0xa000)
        ? ssector[idx & 0x7fff]
        : nodes[idx & 0x7fff];
};

export interface AnimatedTexture {
    frames: string[];
    current: number;
    target: Writable<string>;
}

export class DoomMap {
    readonly name: string;
    readonly things: Thing[];
    readonly linedefs: LineDef[];
    readonly sidedefs: SideDef[];
    readonly vertexes: Vertex[];
    readonly sectors: Sector[];
    readonly subsectors: SubSector[];
    readonly segs: Seg[];
    readonly nodes: TreeNode[];
    readonly renderSectors: RenderSector[];

    readonly animatedTextures: AnimatedTexture[] = [];

    constructor(wad: DoomWad, index) {
        this.name = wad.raw[index].name;

        this.things = wad.raw[index + 1].contents.entries;
        this.sectors = wad.raw[index + 8].contents.entries.map(s => toSector(s));
        this.vertexes = wad.raw[index + 4].contents.entries;
        this.sidedefs = wad.raw[index + 3].contents.entries.map(e => toSideDef(e, this.sectors));
        this.linedefs = wad.raw[index + 2].contents.entries.map(e => toLineDef(e, this.vertexes, this.sidedefs));
        this.segs = wad.raw[index + 5].contents.entries.map(e => toSeg(e, this.vertexes, this.linedefs));
        this.subsectors = wad.raw[index + 6].contents.entries.map(e => toSubSector(e, this.segs));
        this.nodes = wad.raw[index + 7].contents.entries.map(d => toNode(d));
        this.nodes.forEach(n => {
            n.childLeft = assignChild(n.childLeft, this.nodes, this.subsectors);
            n.childRight = assignChild(n.childRight, this.nodes, this.subsectors);
        });
        this.renderSectors = buildRenderSectors(this.nodes);

        // TOOD: we could be even more efficient by using only one store per texture name (rather than one store per sidedef/flat)
        for (const rs of this.renderSectors) {
            this.initializeTextureAnimation(wad, rs.sector.floorFlat, 'animatedFlatInfo');
            this.initializeTextureAnimation(wad, rs.sector.ceilFlat, 'animatedFlatInfo');
        }
        for (const linedef of this.linedefs) {
            if (linedef.left) {
                this.initializeTextureAnimation(wad, linedef.left.upper, 'animatedWallInfo');
                this.initializeTextureAnimation(wad, linedef.left.middle, 'animatedWallInfo');
                this.initializeTextureAnimation(wad, linedef.left.lower, 'animatedWallInfo');
            }
            if (linedef.right) {
                this.initializeTextureAnimation(wad, linedef.right.upper, 'animatedWallInfo');
                this.initializeTextureAnimation(wad, linedef.right.middle, 'animatedWallInfo');
                this.initializeTextureAnimation(wad, linedef.right.lower, 'animatedWallInfo');
            }
        }
    }

    private initializeTextureAnimation(wad: DoomWad, target: Writable<string>, animInfoFn: 'animatedWallInfo' | 'animatedFlatInfo') {
        target.subscribe(v => {
            const animInfo = wad[animInfoFn](v);
            if (animInfo) {
                this.animatedTextures.push({ frames: animInfo[1], current: animInfo[0], target });
            }
        })();
    }

    findSector(x: number, y: number): Sector {
        let node: TreeNode | SubSector = this.nodes[this.nodes.length - 1];
        while (true) {
            if ('segs' in node) {
                return node.sector;
            }
            // is Left https://stackoverflow.com/questions/1560492
            const cross = (node.v2.x - node.v1.x) * (y - node.v1.y) - (node.v2.y - node.v1.y) * (x - node.v1.x);
            if (cross > 0) {
                node = node.childLeft
            } else {
                node = node.childRight;
            }
        }
    }
}

type RGB = string;
type Palette = RGB[];

export class DoomWad {
    private mapIndex = new Map<string, number>();
    palettes: Palette[] = [];
    raw: any;

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
    }

    readMap(name: string) {
        const index = this.mapIndex.get(name)
        return new DoomMap(this, index);
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

    private texturesNames(): string[] {
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

    private flatsNames(): string[] {
        const fStartIndex = this.raw.findIndex(e => e.name === 'F_START');
        const fEndIndex = this.raw.findIndex(e => e.name === 'F_END');
        return this.raw.slice(fStartIndex, fEndIndex + 1).map(e => e.name);
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
        return 'missing';
    }

    flatTextureData(name: string) {
        // debugger;
        const uname = name.toUpperCase();
        const fStartIndex = this.raw.findIndex(e => e.name === 'F_START');
        const fEndIndex = this.raw.findIndex(e => e.name === 'F_END');

        const data = this.lumpByName(uname);
        const idx = this.raw.indexOf(data);
        if (idx > fStartIndex && idx < fEndIndex) {
            return this.readFlat(data);
        }

        console.warn('missing flat:' + uname)
        return 'missing';
    }

    private lumpByName(name: string) {
        return this.raw.find(p => p.name === name);
    }

    private assemblePatchGraphic(pnames: string[], textureData: any) {
        const { width, height, patches } = textureData;

        const buffer = new Uint8Array(4 * width * height);
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

        return { width, height, buffer };
    }

    private textureGraphic(lumpData: any) {
        const pic = this.doomPicture(lumpData);
        if (typeof pic === 'string') {
            return pic;
        }
        const { width, height, data } = pic;

        let buffer = new Uint8Array(4 * width * height);
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

        return { width, height, buffer };
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

        let buffer = new Uint8Array(4 * width * height);
        for (var i = 0; i < size; i++) {
            let col = hexToRgb(this.palettes[0][data[i]]);
            buffer[i * 4 + 0] = col.r;
            buffer[i * 4 + 1] = col.g;
            buffer[i * 4 + 2] = col.b;
            buffer[i * 4 + 3] = 255;
        }

        return { width, height, buffer };
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
        let xOffset = dv.getUint16(4, true);
        let yOffset = dv.getUint16(6, true);
        if (width > 256) {
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

        var columns = [];
        for (let i = 0; i < width; i++) {
            columns[i] = dv.getUint32(8 + (i * 4), true);
        }

        var position = 0;
        var pixelCount = 0;
        for (let i = 0; i < width; i++) {
            position = columns[i];

            let rowStart = 0;
            while (rowStart != 255) {
                rowStart = dv.getUint8(position);
                position += 1;

                if (rowStart == 255) break;

                pixelCount = dv.getUint8(position);
                position += 2;

                for (let j = 0; j < pixelCount; j++) {
                    data[((rowStart + j) * width) + i] = dv.getUint8(position);
                    position += 1;
                }
                position += 1;
            }
        }

        return { width, height, data };
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

export interface RenderSector {
    sector: Sector;
    vertexes: Vertex[];
    // these are only helpful for debugging. Maybe we can remove them?
    subsec: SubSector;
    bspLines: Vertex[][];
}

function buildRenderSectors(nodes: TreeNode[]) {
    let sectors: RenderSector[] = [];
    let bspLines = [];

    function visitNodeChild(child: TreeNode | SubSector) {
        if ('segs' in child) {
            const sector = child.sector;
            const vertexes = subsectorVerts(child, bspLines);
            sectors.push({ sector, vertexes, subsec: child, bspLines: [...bspLines] })
        } else {
            visitNode(child);
        }
    }

    function visitNode(node: TreeNode) {
        bspLines.push([node.v1, node.v2]);
        visitNodeChild(node.childLeft);
        bspLines.pop();

        bspLines.push([node.v2, node.v1]);
        visitNodeChild(node.childRight);
        bspLines.pop();
    }

    visitNode(nodes[nodes.length - 1]);
    return sectors;
}

function subsectorVerts(ssec: SubSector, bspLines: Vertex[][]) {
    // explicit points
    let segLines = ssec.segs.map(e => [e.vx1, e.vx2]);
    let verts = segLines.flat();

    // implicit points are much more complicated. It took me a while to actually figure this all out.
    // Here are some helpful links:
    // - https://www.doomworld.com/forum/topic/105730-drawing-flats-from-ssectors/
    // - https://www.doomworld.com/forum/topic/50442-dooms-floors/
    // - https://doomwiki.org/wiki/Subsector
    //
    // This source code below was particularly helpful and I implemented something quite similar:
    // https://github.com/cristicbz/rust-doom/blob/6aa7681cee4e181a2b13ecc9acfa3fcaa2df4014/wad/src/visitor.rs#L670
    for (let i = 0; i < bspLines.length - 1; i++) {
        for (let j = i; j < bspLines.length; j++) {
            let point = intersectionPoint(bspLines[i], bspLines[j]);
            if (!point) {
                continue;
            }

            // The intersection point must lie both within the BSP volume and the segs volume.
            // the constants here are a little bit of trial and error but E1M1 had a
            // couple of subsectors in the zigzag room that helped
            let insideBsp = bspLines.map(l => signedLineDistance(l, point)).every(dist => dist <= .1);
            let insideSeg = segLines.map(l => signedLineDistance(l, point)).every(dist => dist >= -100);
            if (insideBsp && insideSeg) {
                verts.push(point);
            }
        }
    }
    return centerSort(verts)
}