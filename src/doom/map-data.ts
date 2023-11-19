import { store, type Store } from "./store";
import type { DoomWad } from "./wad/doomwad";
import { Vector3 } from "three";
import { MapObject } from "./map-object";
import { centerSort, closestPoint, lineAABB, lineBounds, lineLineIntersect, pointOnLine, signedLineDistance, sweepAABBAABB, sweepAABBLine, type Bounds, type Vertex } from "./math";
import { MapObjectIndex, MFFlags } from "./doom-things-info";
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
    // used by renderer
    transparentDoorHack: boolean;
    transparentWindowHack: boolean;
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
    transparentDoorHack: false,
    transparentWindowHack: false,
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
    // re-compute this angle because the integer angle (-32768 -> 32767) was not precise enough
    // (if we don't do this, we get walls that sometimes are little bit misaligned in E1M1 - and many other places)
    angle: Math.atan2(
        vertexes[item.vertexEnd].y - vertexes[item.vertexStart].y,
        vertexes[item.vertexEnd].x - vertexes[item.vertexStart].x,
    ),
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

// this bounds will never be true when testing for collisions because if something
// is bigger than left, it will be less than right and fail (same for top and bottom)
const _invalidBounds: Bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
export interface SubSector {
    num: number;
    sector: Sector;
    segs: Seg[];
    vertexes: Vertex[];
    bspLines: Vertex[][]; // <-- useful for debugging but maybe we can remove it?
    // for collision detection
    mobjs: Set<MapObject>;
    bounds: Bounds;
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
    // bounds and vertexes will be populated by completeSubSectors()
    bounds: _invalidBounds,
    vertexes: [],
    bspLines: [],
});

export interface TreeNode {
    v: Vertex[];
    boundsRight: Bounds;
    boundsLeft: Bounds;
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
export interface LineTraceHit extends BaseTraceHit {
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
    readonly blockMapBounds: Bounds;

    constructor(readonly wad: DoomWad, lumps: any[]) {
        this.things = lumps[1].contents.entries;
        this.sectors = lumps[8].contents.entries.map((s, i) => toSector(i, s));
        this.vertexes = lumps[4].contents.entries;
        fixVertexes(
            this.vertexes,
            lumps[2].contents.entries, // linedefs
            lumps[5].contents.entries, // segs
            lumps[7].contents.entries, // bsp nodes
        );

        const blockmap = lumps[10].contents;
        this.blockMapBounds = {
            top: blockmap.originY + blockmap.numRows * 128,
            left: blockmap.originX,
            bottom: blockmap.originY,
            right: blockmap.originX + blockmap.numCols * 128,
        }
        const sidedefs: SideDef[] = lumps[3].contents.entries.map(e => toSideDef(e, this.sectors));
        this.linedefs = lumps[2].contents.entries.map((e, i) => toLineDef(i, e, this.vertexes, sidedefs));
        const segs: Seg[] = lumps[5].contents.entries.map(e => toSeg(e, this.vertexes, this.linedefs));
        const subsectors: SubSector[] = lumps[6].contents.entries.map((e, i) => toSubSector(i, e, segs));

        this.nodes = lumps[7].contents.entries.map(d => toNode(d));
        this.nodes.forEach(n => {
            n.childLeft = assignChild(n.childLeft, this.nodes, subsectors);
            n.childRight = assignChild(n.childRight, this.nodes, subsectors);
        });
        const rootNode = this.nodes[this.nodes.length - 1];
        completeSubSectors(rootNode, subsectors);
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

        // really? linedefs without segs? I've only found this in a few final doom maps (plutonia29, tnt20, tnt21, tnt27)
        // and all of them are two-sided, most have special flags which is a particular problem. Because we are detection
        // collisions with subsectors and segs, we miss collisions with specials lines and key level events won't happen.
        // To fix this, we add fake segs based on the intersection of the linedef and the subsector bounding box.
        // NOTE: segmenting this way results in duplicates (ie. the same section of a linedef may be segmented into multiple
        // subsectors if the subector bounds overlap or the linedef is on the edge of the bounds) so room to improve.
        const segLines = new Set(segs.map(seg => seg.linedef));
        const linedefsWithoutSegs = this.linedefs.filter(ld => !segLines.has(ld));
        const lineStart = new Vector3();
        const lineVec = new Vector3();
        for (const linedef of linedefsWithoutSegs) {
            lineStart.set(linedef.v[0].x, linedef.v[0].y, 0);
            lineVec.set(linedef.v[1].x - linedef.v[0].x, linedef.v[1].y - linedef.v[0].y, 0);
            // note: offset and angle are not used
            const partialSeg = { linedef, offset: 0, angle: 0 };

            this.subsectorTrace(lineStart, lineVec, 0, subsec => {
                const intersect = lineBounds(linedef.v, subsec.bounds);
                if (intersect) {
                    const v1 = { x: intersect[0].x, y: intersect[0].y };
                    const v2 = { x: intersect[1].x, y: intersect[1].y };
                    subsec.segs.push({ ...partialSeg, v: [v1, v2], direction: 0 });
                    if (linedef.left) {
                        subsec.segs.push({ ...partialSeg, v: [v2, v1], direction: 1 });
                    }
                }
                return true; // continue to next subsector
            });
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
            if (ld.left) { // two-sided
                if (ld.left.sector === sector) {
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
    const moveBounds = { left: 0, right: 0, top: 0, bottom: 0 };

    return (start: Vector3, move: Vector3, radius: number, onHit: HandleTraceHit<SubSector>) => {
        end.copy(move).add(start).addScalar(radius);
        moveBounds.left = Math.min(start.x, start.x + move.x) - radius;
        moveBounds.right = Math.max(start.x, start.x + move.x) + radius;
        moveBounds.top = Math.min(start.y, start.y + move.y) - radius;
        moveBounds.bottom = Math.max(start.y, start.y + move.y) + radius;

        let complete = false;
        function visitNode(node: TreeNode | SubSector) {
            if (complete) {
                return;
            }
            if ('segs' in node) {
                // BSP queries always end up in some node (even if we're outside the map)
                // so check and make sure the aabb's overlap
                const missBox = (
                    node.bounds.left > moveBounds.right
                    || node.bounds.right < moveBounds.left
                    || node.bounds.top > moveBounds.bottom
                    || node.bounds.bottom < moveBounds.top);
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
        node = side < 0 ? node.childLeft : node.childRight;
    }
}

function completeSubSectors(root: TreeNode, subsectors: SubSector[]) {
    let bspLines = [];

    function visitNodeChild(child: TreeNode | SubSector) {
        if ('segs' in child) {
            child.vertexes = subsectorVerts(child.segs, bspLines);
            child.bspLines = [...bspLines];
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
    // must be done after visiting all the subsectors because that fills in the initial implicit vertexes
    subsectors.forEach(subsec => addExtraImplicitVertexes(subsec, createSubsectorTrace(root)));
}

function subsectorVerts(segs: Seg[], bspLines: Vertex[][]) {
    // explicit points
    let verts = segs.map(e => e.v).flat();

    // implicit points requiring looking at bsp lines that cut this subsector. It took me a while to figure this out.
    // Here are some helpful links:
    // - https://www.doomworld.com/forum/topic/105730-drawing-flats-from-ssectors/
    // - https://www.doomworld.com/forum/topic/50442-dooms-floors/
    // - https://doomwiki.org/wiki/Subsector
    //
    // This source code below was particularly helpful and I implemented something quite similar:
    // https://github.com/cristicbz/rust-doom/blob/6aa7681cee4e181a2b13ecc9acfa3fcaa2df4014/wad/src/visitor.rs#L670
    // NOTE: because we've "fixed" vertexes, we can use very low constants to compare insideBsp and insideSeg
    let segLines = segs.map(e => e.v);
    for (let i = 0; i < bspLines.length - 1; i++) {
        for (let j = i; j < bspLines.length; j++) {
            let point = lineLineIntersect(bspLines[i], bspLines[j]);
            if (!point) {
                continue;
            }

            // The intersection point must lie both within the BSP volume and the segs volume.
            // the constants here are a little bit of trial and error but E1M1 had a
            // couple of subsectors in the zigzag room that helped and E3M6.
            // FIXME: plutonia MAP25 has a few gaps (-500,-700) and (-1220,-940)
            let insideBsp = bspLines.map(l => signedLineDistance(l, point)).every(dist => dist <= .01);
            let insideSeg = segLines.map(l => signedLineDistance(l, point)).every(dist => dist >= -1);
            if (insideBsp && insideSeg) {
                verts.push({ x: point.x, y: point.y, implicitLines: [bspLines[i], bspLines[j]] } as any);
            }
        }
    }

    const maxDist = .2;
    // remove vertexes that are "similar"
    verts = verts.filter((v, i, arr) => arr.findIndex(e => Math.abs(e.x - v.x) < maxDist && Math.abs(e.y - v.y) < maxDist) === i);
    return centerSort(verts);
}

function fixVertexes(
    vertexes: Vertex[],
    lineDefData: any[],
    segData: any[],
    bspNodes: any[],
) {
    // Doom vertexes are integers so segs from integers can't always be on the line. These "fixes" are mostly
    // about taking seg vertices that are close to a linedef but not actually on the linedef. Once we put them on
    // the linedef, they don't always intersect with the bsp lines so we correct them again later
    // (see addExtraImplicitVertexes()).
    for (const seg of segData) {
        const ld = lineDefData[seg.linedef];
        const line = [vertexes[ld.vertexStartIdx], vertexes[ld.vertexEndIdx]];

        const vx1 = vertexes[seg.vertexStart];
        if (!pointOnLine(vx1, line)) {
            vertexes[seg.vertexStart] = closestPoint(line, vx1);
        }

        const vx2 = vertexes[seg.vertexEnd];
        if (!pointOnLine(vx2, line)) {
            vertexes[seg.vertexEnd] = closestPoint(line, vx2);
        }
    }

    // adjust bsp lines based on changes to vertexes above
    for (const node of bspNodes) {
        const vx1 = { x: node.xStart, y: node.yStart };
        let closest = closestVertex(vx1, vertexes);
        node.xStart = closest.x;
        node.yStart = closest.y;

        const vx2 = { x: node.xStart + node.xChange, y: node.yStart + node.yChange };
        closest = closestVertex(vx2, vertexes);
        node.xChange = closest.x - node.xStart;
        node.yChange = closest.y - node.yStart;
    }
}

const distSqr = (a: Vertex, b: Vertex) => (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
function closestVertex(p: Vertex, vertexes: Vertex[]) {
    let dist = Infinity;
    let closest = p;
    for (const v of vertexes) {
        let d = distSqr(p, v);
        if (d < dist) {
            dist = d;
            closest = v;
        }
    }
    return closest;
}

const _vec = new Vector3();
function addExtraImplicitVertexes(subsector: SubSector, tracer: ReturnType<typeof createSubsectorTrace>) {
    // Because of corrections in fixVertxes(), we have to realign some points to the bsp lines (eg. sector 92 in E1M5,
    // 6 in E1M4, several in sector 7 in E1M7, sector 109 in E4M2). E3M2 has several lines that aren't right, even without
    // the correctsion from fixVertexes() (eg. near big brown tree in sector 60, near sector 67).
    // There are probably more in other maps but this is what I've found so far.
    //
    // This whole thing is a kludge though.
    //
    // This function adjusts the vertexes of each subsector such that they are touching the edges of other subsectors.
    // There is a still a spot in sector 31 of E3M2 that isn't fixed by this because those vertexes are not implicit
    // vertexes. Other than E3M2, adding these vertices fixes all other places I could find (although I assume that
    // if there is one defect in E3M2, there are others in other maps that I just didn't find).
    for (const vert of subsector.vertexes) {
        if (!('implicitLines' in vert)) {
            continue;
        }

        const bspLines = vert.implicitLines as Vertex[][];
        _vec.set(vert.x, vert.y, 0);
        tracer(_vec, zeroVec, 5, subs => {
            if (subs === subsector) {
                return true; // skip this subsector
            }

            const edges = [];
            edges.push([subs.vertexes[0], subs.vertexes[subs.vertexes.length - 1]]);
            for (let i = 1; i < subs.vertexes.length; i++) {
                edges.push([subs.vertexes[i - 1], subs.vertexes[i]]);
            }

            const onEdge = edges.reduce((on, line) => on || pointOnLine(vert, line), false);
            if (onEdge) {
                return true; // vertex is already on the edge of a neighbour subsector so we're all good
            }

            // vertex is not on the edge of a neighbour subsector so find the closest point (at most 2px away) that is on both the bsp and sub sector line
            let dist = 4;
            let closest = { x: 0, y: 0 };
            for (const edge of edges) {
                for (const bspLine of bspLines) {
                    const p = lineLineIntersect(bspLine, edge);
                    if (!p || !pointOnLine(p, edge)) {
                        continue;
                    }
                    const d = distSqr(p, vert);
                    if (d > 0 && d < dist) {
                        dist = d;
                        closest.x = p.x;
                        closest.y = p.y;
                    }
                }
            }
            // if we've found a point, add it
            if (dist < 4) subsector.vertexes.push(closest);
            return true;
        });
    }

    // re-update subsector vertexes but don't merge any additional points added above
    subsector.vertexes = centerSort(subsector.vertexes);
}

function computeBounds(verts: Vertex[], allowLinearBounds = false): Bounds {
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

    const linearBounds = (left - right === 0 || top - bottom === 0);
    if (linearBounds && !allowLinearBounds) {
        // E4M7 (around sectors 78-87 at least) and several plutonia and tnt maps have bounds where one dimension is 0.
        // These bounds get even more messed up with the implicit vertices added by subsectorVerts so exclude them
        // and recompute the bounds
        return computeBounds(verts.filter(e => !('implicitLines' in e)), true);
    }
    return { left, right, top, bottom };
}
