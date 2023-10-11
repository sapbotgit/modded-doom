import { store, type Store } from "./store";
import type { DoomWad } from "./wad/doomwad";
import { Vector3 } from "three";
import { MapObject } from "./map-object";
import { lineAABB, signedLineDistance, sweepAABBAABB, sweepAABBLine, type Vertex } from "./math";
import { MFFlags } from "./doom-things-info";
import type { GameTime } from "./game";

export type Action = (time: GameTime) => void;

export interface Thing {
    x: number;
    y: number;
    angle: number;
    type: number;
    flags: number;
}

export interface LineDef {
    num: number;
    v: Vertex[];
    flags: number;
    special: number;
    tag: number;
    right?: SideDef;
    left?: SideDef;
    // derived
    xOffset?: Store<number>;
    // For game processing
    buttonTimer: Action;
    hitC: number; // don't hit the same line twice during collision detection
}
const toLineDef = (num: number, ld: any, vertexes: Vertex[], sidedefs: SideDef[]): LineDef => ({
    num,
    v: [vertexes[ld.vertexStartIdx], vertexes[ld.vertexEndIdx]],
    left: sidedefs[ld.sidedefLeftIdx],
    right: sidedefs[ld.sidedefRightIdx],
    tag: ld.sectorTag,
    special: ld.lineType,
    flags: ld.flags,
    buttonTimer: null,
    hitC: 0,
});

export interface SideDef {
    xOffset: Store<number>;
    yOffset: Store<number>;
    sector: Sector;
    upper: Store<string>;
    lower: Store<string>;
    middle: Store<string>;
}
const toSideDef = (sd: any, sectors: Sector[]): SideDef => ({
    xOffset: store(sd.offsetX),
    yOffset: store(sd.offsetY),
    sector: sectors[sd.sectorId],
    lower: store(fixTextureName(sd.lowerTextureName)),
    middle: store(fixTextureName(sd.normalTextureName)),
    upper: store(fixTextureName(sd.upperTextureName)),
});

function fixTextureName(name: string) {
    return !name || name.startsWith('-') ? undefined : name.split('\u0000')[0].toUpperCase();
}

export interface Seg {
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
    angle: (item.angle * Math.PI / 32768),
    linedef: linedefs[item.linedef],
    direction: item.direction,
    offset: item.offset,
});

export interface Sector {
    num: number;
    tag: number;
    type: number;
    zFloor: Store<number>;
    zCeil: Store<number>;
    light: Store<number>;
    floorFlat: Store<string>;
    ceilFlat: Store<string>;
    // part of skyhack
    skyHeight?: number;
    // Game processing data
    specialData: any;
}
const toSector = (num: number, sd: any): Sector => {
    const sector = {
        num,
        // rev is a reactivity hack to allow me to re-assign textures during sector floor/ceiling change
        // (see Flats.svelte and createFloorAction in Special.ts). We should be able to do better than this
        rev: store(1),
        tag: sd.tag,
        type: sd.specialType,
        zFloor: store(sd.floorZ),
        zCeil: store(sd.ceilZ),
        light: store(sd.light),
        floorFlat: store(fixTextureName(sd.floorFlat)),
        ceilFlat: store(fixTextureName(sd.ceilFlat)),
        specialData: null,
    };
    return sector;
}

export interface SubSector {
    sector: Sector;
    segs: Seg[];
    // for collision detection
    mobjs: MapObject[];
    hitC: number;
}
const toSubSector = (item: any, segs: Seg[]): SubSector => ({
    sector: segs[item.firstSeg].direction ? segs[item.firstSeg].linedef.left.sector : segs[item.firstSeg].linedef.right.sector,
    segs: segs.slice(item.firstSeg, item.firstSeg + item.count),
    mobjs: [],
    hitC: 0,
});

export interface NodeBounds {
    top: number;
    left: number;
    bottom: number;
    right: number;
}
export interface TreeNode {
    v: Vertex[];
    boundsRight: NodeBounds;
    boundsLeft: NodeBounds;
    childRight: TreeNode | SubSector;
    childLeft: TreeNode | SubSector;
}
const toNode = (item: any): TreeNode => ({
    v: [
        { x: item.xStart, y: item.yStart },
        { x: item.xStart + item.xChange, y: item.yStart + item.yChange },
    ],
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

interface BaseTraceHit {
    subsector: SubSector;
    fraction: number; // 0-1 of how far we moved along the desired path
    overlap: number; // used to resolve a tie in hit fraction
    point: Vector3; // point of hit (maybe redundant because we can compute it from fraction and we don't use z anyway)
}
interface LineTraceHit extends BaseTraceHit {
    side: -1 | 1; // did we hit front side (1) or back side (-1)
    line: LineDef;
}
interface SpecialTraceHit extends LineTraceHit {
    special: boolean;
}
interface MapObjectTraceHit extends BaseTraceHit {
    mobj: MapObject;
    axis: 'x' | 'y';
}
interface SectorTraceHit extends BaseTraceHit {
    sector: Sector;
}
export type TraceHit = SectorTraceHit | MapObjectTraceHit | LineTraceHit | SpecialTraceHit;
// return true to continue trace, false to stop
export type HandleTraceHit = (hit: TraceHit) => boolean;

const lastTrace2 = {
    start: new Vector3(),
    end: new Vector3(),
    tMaxX: 0,
    tMaxY: 0,
    tDeltaX: 0,
    tDeltaY: 0,
}
// TODO: there are only a few references to this, it would be nice to remove it completely
class BlockMap {
    readonly bounds: NodeBounds;

    // TODO: remove these after finishing up debugging
    lastTrace = store<{ row: number, col: number }[]>([]);
    traceSegs = store<Seg[]>([]);
    lastTrace2 = store(lastTrace2);

    constructor(
        data: { numCols: number, numRows: number, originX: number, originY: number, linedefsInBlock: { linedefs: number[] }[] }
    ) {
        this.bounds = {
            top: data.originY + data.numRows * 128,
            left: data.originX,
            bottom: data.originY,
            right: data.originX + data.numCols * 128,
        }
    }
}

const zeroVec = new Vector3();
export const hittableThing = MFFlags.MF_SOLID | MFFlags.MF_SPECIAL | MFFlags.MF_SHOOTABLE;
export class MapData {
    private bspTracer: ReturnType<typeof createBspTracer>;
    readonly things: Thing[];
    readonly linedefs: LineDef[];
    readonly vertexes: Vertex[];
    readonly sectors: Sector[];
    readonly nodes: TreeNode[];
    readonly blockmap: BlockMap;

    constructor(readonly wad: DoomWad, index: number) {
        this.things = wad.raw[index + 1].contents.entries;
        this.sectors = wad.raw[index + 8].contents.entries.map((s, i) => toSector(i, s));
        this.vertexes = wad.raw[index + 4].contents.entries;
        const sidedefs: SideDef[] = wad.raw[index + 3].contents.entries.map(e => toSideDef(e, this.sectors));
        this.linedefs = wad.raw[index + 2].contents.entries.map((e, i) => toLineDef(i, e, this.vertexes, sidedefs));
        const segs: Seg[] = wad.raw[index + 5].contents.entries.map(e => toSeg(e, this.vertexes, this.linedefs));
        const subsectors: SubSector[] = wad.raw[index + 6].contents.entries.map(e => toSubSector(e, segs));
        this.nodes = wad.raw[index + 7].contents.entries.map(d => toNode(d));
        this.nodes.forEach(n => {
            n.childLeft = assignChild(n.childLeft, this.nodes, subsectors);
            n.childRight = assignChild(n.childRight, this.nodes, subsectors);
        });
        this.blockmap = new BlockMap(wad.raw[index + 10].contents);
        this.bspTracer = createBspTracer(this.nodes[this.nodes.length - 1]);

        // figure out any sectors that need sky height adjustment
        for (const sector of this.sectors) {
            if (sector.ceilFlat.val === 'F_SKY1') {
                const skyHeight = this.sectorNeighbours(sector)
                    .filter(e => e.ceilFlat.val === 'F_SKY1')
                    .reduce((val, sec) => Math.max(val, sec.zCeil.val), sector.zCeil.val);
                sector.skyHeight = skyHeight;
            }
        }
    }

    findSubSector(x: number, y: number): SubSector {
        let node: TreeNode | SubSector = this.nodes[this.nodes.length - 1];
        while (true) {
            if ('segs' in node) {
                return node;
            }
            const side = signedLineDistance(node.v, { x, y });
            if (side <= 0) {
                node = node.childLeft
            } else {
                node = node.childRight;
            }
        }
    }

    findSector(x: number, y: number): Sector {
        return this.findSubSector(x, y).sector;
    }

    sectorNeighbours(sector: Sector): Sector[] {
        const sectors = [];
        for (const ld of this.linedefs) {
            if (ld.flags & 0x0004) {
                if (ld.left?.sector === sector) {
                    sectors.push(ld.right.sector);
                }
                if (ld.right.sector === sector) {
                    sectors.push(ld.left.sector);
                }
            }
        }
        return sectors.filter((e, i, arr) => arr.indexOf(e) === i && e !== sector);
    }

    traceRay(start: Vector3, move: Vector3, onHit: HandleTraceHit) {
        this.bspTracer(start, move, 0, onHit);
    }

    traceMove(start: Vector3, move: Vector3, radius: number, onHit: HandleTraceHit) {
        this.bspTracer(start, move, radius, onHit);
    }

    traceAABB(position: Vector3, radius: number, onHit: HandleTraceHit) {
        this.bspTracer(position, zeroVec, radius, onHit);
    }
}

function aabbLineOverlap(pos: Vector3, radius: number, line: LineDef) {
    const boxMinX = pos.x - radius;
    const boxMaxX = pos.x + radius;
    const boxMinY = pos.y - radius;
    const boxMaxY = pos.y + radius;
    const lineMinX = Math.min(line.v[0].x, line.v[1].x);
    const lineMaxX = Math.max(line.v[0].x, line.v[1].x);
    const lineMinY = Math.min(line.v[0].y, line.v[1].y);
    const lineMaxY = Math.max(line.v[0].y, line.v[1].y);
    if (lineMinX === lineMaxX) {
        // aabb hit a horizontal line so return y-axis overlap
        return Math.min(boxMaxY, lineMaxY) - Math.max(boxMinY, lineMinY)
    } else if (lineMinY === lineMaxY) {
        // aabb hit a vertical line so return x-axis overlap
        return Math.min(boxMaxX, lineMaxX) - Math.max(boxMinX, lineMinX);
    }
    return 0;
}

const _aabbAabbOverlap = { area: 0, axis: 'x' as 'x' | 'y' }
function aabbAabbOverlap(p1: Vector3, r1: number, p2: Vector3, r2: number) {
    const b1MinX = p1.x - r1;
    const b1MaxX = p1.x + r1;
    const b1MinY = p1.y - r1;
    const b1MaxY = p1.y + r1;
    const b2MinX = p2.x - r2;
    const b2MaxX = p2.x + r2;
    const b2MinY = p2.y - r2;
    const b2MaxY = p2.y + r2;
    const dx = Math.min(b1MaxX, b2MaxX) - Math.max(b1MinX, b2MinX);
    const dy = Math.min(b1MaxY, b2MaxY) - Math.max(b1MinY, b2MinY);
    _aabbAabbOverlap.axis = dx > dy ? 'y' : 'x';
    _aabbAabbOverlap.area = Math.max(0, dx * dy);
    return _aabbAabbOverlap
}

function createBspTracer(root: TreeNode) {
    const end = new Vector3();
    const segNormal = new Vector3();

    return (start: Vector3, move: Vector3, radius: number, onHit: HandleTraceHit) => {
        end.copy(move).add(start);
        const allowZeroDot = move.x !== 0 || move.y !== 0 || move.z !== 0;

        let hits: TraceHit[] = [];
        let complete = false;
        function notifyHits() {
            // sort hits
            hits.sort((a, b) => {
                const dist = a.fraction - b.fraction;
                return Math.abs(dist) < 0.000001 ? b.overlap - a.overlap : dist;
            });

            for (const hit of hits) {
                complete = !onHit(hit);
                if (complete) {
                    break;
                }
            }
            hits.length = 0;
        }

        function visitNode(node: TreeNode | SubSector) {
            if (complete) {
                return;
            }

            if ('segs' in node) {
                let lastDist = 1;
                for (const mobj of node.mobjs) {
                    if (complete) {
                        break;
                    }

                    const hit = sweepAABBAABB(start, radius, move, mobj.position.val, mobj.info.radius);
                    if (hit) {
                        const point = new Vector3(hit.x, hit.y, start.z + move.z * hit.u);
                        const ov = aabbAabbOverlap(point, radius, mobj.position.val, mobj.info.radius);
                        lastDist = hit.u;
                        hits.push({ point, mobj, overlap: ov.area, axis: ov.axis, fraction: hit.u, subsector: node });
                    }
                }
                for (const seg of node.segs) {
                    if (complete) {
                        break;
                    }

                    // Allow trace to pass through back-to-front. This allows things, like a player, to move away from
                    // a wall if they are stuck as long as they move the same direction as the wall normal. The two sided
                    // line is more complicated but that is handled elsewhere because it impacts movement, not bullets or
                    // other traces.
                    // Doom2's MAP03 starts the player exactly against the wall. Without this, we would be stuck :(
                    segNormal.set(seg.vx2.y - seg.vx1.y, seg.vx1.x - seg.vx2.x, 0);
                    const moveDot = move.dot(segNormal);
                    // NOTE: dot === 0 is special. We allow this only when we are moving
                    // (if we aren't moving, dot will always be 0 and we skip everything)
                    if (moveDot > 0 || (moveDot === 0 && allowZeroDot)) {
                        continue;
                    }

                    const hit = sweepAABBLine(start, radius, move, seg.linedef.v);
                    if (hit) {
                        const side = seg.direction ? 1 : -1;
                        const point = new Vector3(hit.x, hit.y, start.z + move.z * hit.u);
                        const overlap = aabbLineOverlap(point, radius, seg.linedef);
                        lastDist = hit.u;
                        hits.push({ overlap, point, side, line: seg.linedef, fraction: hit.u, subsector: node });
                    }
                }
                notifyHits();
                return;
            }

            // we have three cases really:
            // (1) aabb is on the line so check left AND right (only happens when radius > 0)
            // (2) aabb is on the left or the right.
            //  (a) if start and end are on different sides then check both
            //  (b) else just check the start side
            const point = radius > 0 ? lineAABB(node.v, start, radius, false) : null;
            const side = point ? -1 : Math.sign(signedLineDistance(node.v, start));
            visitNode((side <= 0) ? node.childLeft : node.childRight);
            const eside = Math.sign(signedLineDistance(node.v, end));
            if (point || eside !== side) {
                visitNode((side <= 0) ? node.childRight : node.childLeft);
            }
        }
        visitNode(root);
        notifyHits();
    };
}