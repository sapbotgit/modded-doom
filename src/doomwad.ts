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

interface SideDef {
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
    lower: sd.lowerTextureName,
    middle: sd.middleTextureName,
    upper: sd.upperTextureName,
});

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
        const playpal = data.index.find(p => p.name === 'PLAYPAL');
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

        for (let i = 0; i < data.index.length; i++) {
            if (isMap(data.index[i])) {
                this.maps.push(new DoomMap(data.index, i));
            }
        }
    }
}

const isMap = (item) => (
    /^MAP\d\d$/.test(item.name) ||
    /^E\dM\d$/.test(item.name)
);