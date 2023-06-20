//
// Heavily adapted from https://github.com/jmickle66666666/wad-js/blob/develop/src/wad/mapdata.js
//

import KaitaiStream from 'kaitai-struct/KaitaiStream';
import DoomWadRaw from './doom-wad.ksy.js';

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
    action: number;
    tag: number;
    right?: SideDef;
    left?: SideDef;
}
const toLineDef = (ld: any, vertexes: Vertex[], sidedefs: SideDef[]): LineDef => ({
    v1: vertexes[ld.vertexStartIdx],
    v2: vertexes[ld.vertexEndIdx],
    left: sidedefs[ld.sidedefLeftIdx],
    right: sidedefs[ld.sidedefRightIdx],
    tag: ld.sectorTag,
    action: ld.lineType,
    flags: ld.flags,
});

export interface SideDef {
    xOffset: number;
    yOffset: number;
    sector: Sector;
    upper: string;
    lower: string;
    middle: string;
}
const toSideDef = (sd: any, sectors: Sector[]): SideDef => ({
    xOffset: sd.offsetX,
    yOffset: sd.offsetY,
    sector: sectors[sd.sectorId],
    lower: fixTextureName(sd.lowerTextureName),
    middle: fixTextureName(sd.normalTextureName),
    upper: fixTextureName(sd.upperTextureName),
});

function fixTextureName(name: string) {
    return !name || name.startsWith('-') ? undefined : name.split('\u0000')[0];
}

interface Vertex {
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
    zFloor: number;
    zCeil: number;
    floortFlat: string;
    ceilFlat: string;
    light: number;
    type: number;
    tag: number;
}
const toSector = (sd: any): Sector => ({
    zFloor: sd.floorZ,
    floortFlat: sd.floortFlat,
    zCeil: sd.ceilZ,
    ceilFlat: sd.ceilFlat,
    light: sd.light,
    type: sd.specialType,
    tag: sd.tag,
});

export interface SubSector {
    segs: Seg[];
}
const toSubSector = (item: any, segs: Seg[]): SubSector => ({
    segs: segs.slice(item.firstSeg, item.firstSeg + item.count),
});

interface NodeBounds {
    top: number;
    left: number;
    bottom: number;
    right: number;
}
export interface TreeNode {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    boundsRight: NodeBounds;
    boundsLeft: NodeBounds;
    childRight: TreeNode | SubSector;
    childLeft: TreeNode | SubSector;
}
const toNode = (item: any): TreeNode => ({
    x1: item.xStart,
    y1: item.yStart,
    x2: item.xStart + item.xChange,
    y2: item.yStart + item.yChange,
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

    constructor(items, index) {
        this.name = items[index].name;

        this.things = items[index + 1].contents.entries;
        this.sectors = items[index + 8].contents.entries.map(s => toSector(s));
        this.vertexes = items[index + 4].contents.entries;
        this.sidedefs = items[index + 3].contents.entries.map(e => toSideDef(e, this.sectors));
        this.linedefs = items[index + 2].contents.entries.map(e => toLineDef(e, this.vertexes, this.sidedefs));
        this.segs = items[index + 5].contents.entries.map(e => toSeg(e, this.vertexes, this.linedefs));
        this.subsectors = items[index + 6].contents.entries.map(e => toSubSector(e, this.segs));
        this.nodes = items[index + 7].contents.entries.map(d => toNode(d));
        this.nodes.forEach(n => {
            n.childLeft = assignChild(n.childLeft, this.nodes, this.subsectors);
            n.childRight = assignChild(n.childRight, this.nodes, this.subsectors);
        });
    }

    findSector(x: number, y: number): Sector {
        let node: TreeNode | SubSector = this.nodes[this.nodes.length - 1];
        while (true) {
            if ('segs' in node) {
                return node.segs[0].linedef.right.sector;
            }
            // is Left https://stackoverflow.com/questions/1560492
            const cross = (node.x2 - node.x1) * (y - node.y1) - (node.y2 - node.y1) * (x - node.x1);
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
    palettes: Palette[] = [];
    maps: DoomMap[] = [];
    raw: any;

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
                this.maps.push(new DoomMap(this.raw, i));
            }
        }
    }

    textureData(name: string) {
        const uname = name.toUpperCase();
        // use patches first because sometimes flats and patches have the same name
        // https://doomwiki.org/wiki/Flat_and_texture_mixing
        // a better approach would be to use F_START/P_START markers

        // texture from patches
        const pnames = this.lumpByName('PNAMES').contents.names.map(e => e.toUpperCase());
        const texture1 = this.lumpByName('TEXTURE1').contents.textures;
        // not all wads have texture2? (looking at you plutonia...)
        const texture2 = this.lumpByName('TEXTURE2')?.contents.textures ?? [];
        const texture =
            texture1.find(e => e.body.name === uname) ??
            texture2.find(e => e.body.name === uname);
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

const isMap = (item) => (
    /^MAP\d\d$/.test(item.name) ||
    /^E\dM\d$/.test(item.name)
);