import { store, type Store } from "./store";
import type { DoomWad } from "./wad/doomwad";
import { Vector3 } from "three";
import { MapObject } from "./map-object";
import { centerSort, closestPoint, lineAABB, lineLineIntersect, pointOnLine, signedLineDistance, sweepAABBAABB, sweepAABBLine, type Vertex } from "./math";
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
    v: Vertex[];
    angle: number;
    linedef: LineDef;
    direction: number;
    offset: number;
}
const toSeg = (item: any, vertexes: Vertex[], linedefs: LineDef[]): Seg => ({
    v: [vertexes[item.vertexStart], vertexes[item.vertexEnd]],
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

const _nullBounds: NodeBounds = { top: 0, left: 0, right: 0, bottom: 0 };
export interface SubSector {
    num: number;
    sector: Sector;
    segs: Seg[];
    vertexes: Vertex[];
    // for collision detection
    mobjs: Set<MapObject>;
    bounds: NodeBounds;
    hitC: number;
}
const toSubSector = (num: number, item: any, segs: Seg[]): SubSector => ({
    num,
    sector: segs[item.firstSeg].direction
        ? segs[item.firstSeg].linedef.left.sector
        : segs[item.firstSeg].linedef.right.sector,
    segs: segs.slice(item.firstSeg, item.firstSeg + item.count),
    mobjs: new Set(),
    hitC: 0,
    // the next few properties are re-assigned in completeSubSectors() below
    bounds: _nullBounds,
    vertexes: [],
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
    flat: 'floor' | 'ceil';
}
export type TraceHit = SectorTraceHit | MapObjectTraceHit | LineTraceHit | SpecialTraceHit;
// return true to continue trace, false to stop
export type HandleTraceHit<T=TraceHit> = (hit: T) => boolean;

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

export const zeroVec = new Vector3();
export const hittableThing = MFFlags.MF_SOLID | MFFlags.MF_SPECIAL | MFFlags.MF_SHOOTABLE;
export class MapData {
    private subsectorTrace: ReturnType<typeof createSubsectorTrace>;
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
        this.blockmap = new BlockMap(wad.raw[index + 10].contents);
        const sidedefs: SideDef[] = wad.raw[index + 3].contents.entries.map(e => toSideDef(e, this.sectors));
        this.linedefs = wad.raw[index + 2].contents.entries.map((e, i) => toLineDef(i, e, this.vertexes, sidedefs));
        const segs: Seg[] = wad.raw[index + 5].contents.entries.map(e => toSeg(e, this.vertexes, this.linedefs));
        const subsectors: SubSector[] = wad.raw[index + 6].contents.entries.map((e, i) => toSubSector(i, e, segs));

        this.nodes = wad.raw[index + 7].contents.entries.map(d => toNode(d));
        this.nodes.forEach(n => {
            n.childLeft = assignChild(n.childLeft, this.nodes, subsectors);
            n.childRight = assignChild(n.childRight, this.nodes, subsectors);
        });
        const rootNode = this.nodes[this.nodes.length - 1];
        completeSubSectors(rootNode);
        this.bspTracer = createBspTracer(rootNode);
        this.subsectorTrace = createSubsectorTrace(rootNode);

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
        return findSubSector(this.nodes[this.nodes.length - 1], x, y);
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

    traceSubsectors(start: Vector3, move: Vector3, radius: number, onHit: HandleTraceHit<SubSector>) {
        this.subsectorTrace(start, move, radius, onHit);
    }
}

function aabbLineOverlap(pos: Vector3, radius: number, line: LineDef) {
    const lineMinX = Math.min(line.v[0].x, line.v[1].x);
    const lineMaxX = Math.max(line.v[0].x, line.v[1].x);
    const lineMinY = Math.min(line.v[0].y, line.v[1].y);
    const lineMaxY = Math.max(line.v[0].y, line.v[1].y);
    if (lineMinX === lineMaxX) {
        // aabb hit a horizontal line so return y-axis overlap
        const boxMinY = pos.y - radius;
        const boxMaxY = pos.y + radius;
        return Math.min(boxMaxY, lineMaxY) - Math.max(boxMinY, lineMinY)
    } else if (lineMinY === lineMaxY) {
        // aabb hit a vertical line so return x-axis overlap
        const boxMinX = pos.x - radius;
        const boxMaxX = pos.x + radius;
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
    const subsectorTrace = createSubsectorTrace(root);
    const segNormal = new Vector3();

    return (start: Vector3, move: Vector3, radius: number, onHit: HandleTraceHit) => {
        const allowZeroDot = move.x !== 0 || move.y !== 0 || move.z !== 0;
        let hits: TraceHit[] = [];

        subsectorTrace(start, move,radius, subsector => {
            // collide with things
            for (const mobj of subsector.mobjs) {
                const hit = sweepAABBAABB(start, radius, move, mobj.position.val, mobj.info.radius);
                if (hit) {
                    const point = new Vector3(hit.x, hit.y, start.z + move.z * hit.u);
                    const ov = aabbAabbOverlap(point, radius, mobj.position.val, mobj.info.radius);
                    hits.push({ subsector, point, mobj, overlap: ov.area, axis: ov.axis, fraction: hit.u });
                }
            }

            // collide with walls
            for (const seg of subsector.segs) {
                // Allow trace to pass through back-to-front. This allows things, like a player, to move away from
                // a wall if they are stuck as long as they move the same direction as the wall normal. The two sided
                // line is more complicated but that is handled elsewhere because it impacts movement, not bullets or
                // other traces.
                // Doom2's MAP03 starts the player exactly against the wall. Without this, we would be stuck :(
                segNormal.set(seg.v[1].y - seg.v[0].y, seg.v[0].x - seg.v[1].x, 0);
                const moveDot = move.dot(segNormal);
                // NOTE: dot === 0 is special. We allow this only when we are moving
                // (if we aren't moving, dot will always be 0 and we skip everything)
                if (moveDot > 0 || (moveDot === 0 && allowZeroDot)) {
                    continue;
                }

                const hit = sweepAABBLine(start, radius, move, seg.v);
                if (hit) {
                    const side = seg.direction ? 1 : -1;
                    const point = new Vector3(hit.x, hit.y, start.z + move.z * hit.u);
                    const overlap = aabbLineOverlap(point, radius, seg.linedef);
                    hits.push({ subsector, overlap, point, side, line: seg.linedef, fraction: hit.u });
                }
            }

            // collide with floor and ceiling (mostly for bullets and projectiles)
            const floorHit = flatHit('floor', subsector, subsector.sector.zFloor.val);
            if (floorHit) {
                hits.push(floorHit);
            }
            const ceilHit = flatHit('ceil', subsector, subsector.sector.zCeil.val);
            if (ceilHit) {
                hits.push(ceilHit);
            }

            // sort hits by distance (or by overlap if distance is too close)
            hits.sort((a, b) => {
                const dist = a.fraction - b.fraction;
                return Math.abs(dist) < 0.000001 ? b.overlap - a.overlap : dist;
            });

            let complete = false;
            for (let i = 0; !complete && i < hits.length; i++) {
                complete = !onHit(hits[i]);
            }
            hits.length = 0;
            return !complete;
        });

        function flatHit(flat: SectorTraceHit['flat'], subsector: SubSector, zFlat: number): SectorTraceHit {
            const u = (zFlat - start.z) / move.z;
            if (u < 0 || u > 1) {
                return null
            }
            const point = start.clone().addScaledVector(move, u);
            const inSector = findSubSector(root, point.x, point.y) === subsector;
            if (!inSector) {
                return null;
            }
            return { flat, subsector, point, overlap: 0, fraction: u };
        }
    };
}

function createSubsectorTrace(root: TreeNode) {
    const end = new Vector3();
    return (start: Vector3, move: Vector3, radius: number, onHit: HandleTraceHit<SubSector>) => {
        end.copy(move).add(start);

        let complete = false;
        function visitNode(node: TreeNode | SubSector) {
            if (complete) {
                return;
            }
            if ('segs' in node) {
                // BSP queries always end up in some node (even if we're outside the map)
                // so check and make sure the aabb's overlap
                const mLeft = Math.min(start.x, start.x + move.x) - radius;
                const mRight = Math.max(start.x, start.x + move.x) + radius;
                const mTop = Math.min(start.y, start.y + move.y) - radius;
                const mBottom = Math.max(start.y, start.y + move.y) + radius;
                const missBox = (node.bounds.left > mRight || node.bounds.right < mLeft
                    || node.bounds.top > mBottom || node.bounds.bottom < mTop);
                if (missBox) {
                    return;
                }

                complete = !onHit(node);
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
    };
}

const _findVec = new Vector3();
function findSubSector(root: TreeNode, x: number, y: number) {
    _findVec.set(x, y, 0);
    let node: TreeNode | SubSector = root;
    while (true) {
        if ('segs' in node) {
            return node;
        }
        const side = signedLineDistance(node.v, _findVec);
        node = side <= 0 ? node.childLeft : node.childRight;
    }
}

function completeSubSectors(root: TreeNode) {
    let bspLines = [];

    function visitNodeChild(child: TreeNode | SubSector) {
        if ('segs' in child) {
            child.vertexes = subsectorVerts(child.segs, bspLines);
            // originally I was going to use the TreeNode bounds (boundsLeft/boundsRight) but those bounds don't
            // include the implicit edges from bsp lines so the boxes aren't right. It's easy to compute bounds from
            // a set of vertexes anyway
            child.bounds = computeBounds(child.vertexes);
        } else {
            visitNode(child);
        }
    }

    function visitNode(node: TreeNode) {
        bspLines.push(node.v);
        visitNodeChild(node.childLeft);
        bspLines.pop();

        bspLines.push([node.v[1], node.v[0]]);
        visitNodeChild(node.childRight);
        bspLines.pop();
    }
    visitNode(root);
}

function subsectorVerts(segs: Seg[], bspLines: Vertex[][]) {
    fixSegs(segs);
    // explicit points
    let segLines = segs.map(e => e.v);
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
            let point = lineLineIntersect(bspLines[i], bspLines[j]);
            if (!point) {
                continue;
            }

            // The intersection point must lie both within the BSP volume and the segs volume.
            // the constants here are a little bit of trial and error but E1M1 had a
            // couple of subsectors in the zigzag room that helped
            let insideBsp = bspLines.map(l => signedLineDistance(l, point)).every(dist => dist <= .1);
            let insideSeg = segLines.map(l => signedLineDistance(l, point)).every(dist => dist >= -1000);
            if (insideBsp && insideSeg) {
                verts.push({ x: point.x, y: point.y });
            }
        }
    }
    return centerSort(verts)
}

function fixSegs(segs: Seg[]) {
    for (const seg of segs) {
        // FIXME: this makes a bit of a mess of some sectors. I wonder if we should fix it in the map
        // vertex list so that neighbouring subsectors also fix their verts?
        if (!pointOnLine(seg.v[0], seg.linedef.v)) {
            seg.v[0] = closestPoint(seg.linedef.v, seg.v[0]);
        }
        if (!pointOnLine(seg.v[1], seg.linedef.v)) {
            seg.v[1] = closestPoint(seg.linedef.v, seg.v[1]);
        }

        // re-compute this angle because the integer angle (-32768 -> 32767) was not precise enough
        // (if we don't do this, we get walls that sometimes are little bit misaligned in E1M1 - and many other places)
        seg.angle = Math.atan2(seg.v[1].y - seg.v[0].y, seg.v[1].x - seg.v[0].x);
    }
}

function computeBounds(verts: Vertex[]): NodeBounds {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;

    for (let v of verts) {
        left = Math.min(left, v.x);
        right = Math.max(right, v.x);
        top = Math.min(top, v.y);
        bottom = Math.max(bottom, v.y);
    }

    return { left, right, top, bottom }
}