import { store, type Store } from "./store";
import type { DoomWad } from "./wad/doomwad";
import { Vector3, PerspectiveCamera, Matrix4, Frustum, Box3 } from "three";
import { MapObject } from "./map-object";
import { AmanatidesWooTrace, HALF_PI, lineAABB, lineLineIntersect, signedLineDistance, sweepAABBAABB, sweepAABBLine, type Vertex } from "./math";
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

interface Block {
    linedefs: LineDef[];
    things: MapObject[];
    traceCount: number; // used so to avoid hitting the same block multiple times in a single trace
}

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
const gridSize = 128;
type BlockHandler = (block: Block, bounds: NodeBounds) => boolean;
class BlockMap {
    private map: Block[] = [];
    private numCols: number;
    private numRows: number;
    private traceCount = 0;
    private objMap = new Map<MapObject, Block>();
    private lineTrace: AmanatidesWooTrace;
    private mTrace: AmanatidesWooTrace;
    private ccwTrace: AmanatidesWooTrace;
    private cwTrace: AmanatidesWooTrace;
    private blockBounds: NodeBounds = { top: 0, left: 0, bottom: 0, right: 0 };
    readonly bounds: NodeBounds;

    // TODO: remove these after finishing up debugging
    lastTrace = store<{ row: number, col: number }[]>([]);
    traceSegs = store<Seg[]>([]);
    lastTrace2 = store(lastTrace2);

    constructor(
        data: { numCols: number, numRows: number, originX: number, originY: number, linedefsInBlock: { linedefs: number[] }[] },
        linedefs: LineDef[],
    ) {
        this.numCols = data.numCols;
        this.numRows = data.numRows;
        this.bounds = {
            top: data.originY + data.numRows * 128,
            left: data.originX,
            bottom: data.originY,
            right: data.originX + data.numCols * 128,
        }
        this.map = data.linedefsInBlock.map(block => ({
            traceCount: 0,
            things: [],
            linedefs: block.linedefs
                .filter((e, i) => e >= 0 && !(i === 0 && e === 0))
                .map(e => linedefs[e]),
        }));

        this.lineTrace = new AmanatidesWooTrace(this.bounds.left, this.bounds.bottom, gridSize, this.numRows, this.numCols);
        this.mTrace = new AmanatidesWooTrace(this.bounds.left, this.bounds.bottom, gridSize, this.numRows, this.numCols);
        this.ccwTrace = new AmanatidesWooTrace(this.bounds.left, this.bounds.bottom, gridSize, this.numRows, this.numCols);
        this.cwTrace = new AmanatidesWooTrace(this.bounds.left, this.bounds.bottom, gridSize, this.numRows, this.numCols);
    }

    watch(mobj: MapObject) {
        if (!(mobj.info.flags & hittableThing) || mobj.info.flags & MFFlags.MF_NOBLOCKMAP) {
            return;
        }
        mobj.position.subscribe(pos => {
            const oldBlock = this.objMap.get(mobj);
            const idx = this.queryIndex(pos.x, pos.y);
            if (idx === -1) {
                return;
            }
            const newBlock = this.map[idx];
            if (oldBlock === newBlock) {
                return;
            }

            this.unwatch(mobj);
            newBlock.things.push(mobj);
            this.objMap.set(mobj, newBlock);
        });
    }

    unwatch(mobj: MapObject) {
        // TODO: perf improvement with array manipulation?
        const oldBlock = this.objMap.get(mobj);
        if (oldBlock) {
            oldBlock.things = oldBlock.things.filter(e => e !== mobj);
        }
    }

    traceRay(start: Vector3, vel: Vector3, onBlock: BlockHandler) {
        this.lastTrace.set([]);
        lastTrace2.start.copy(start);
        lastTrace2.end.copy(start).add(vel);

        this.traceCount += 1;
        let coords = this.lineTrace.init(start.x, start.y, vel);
        let continueTrace = true;
        while (coords && continueTrace) {
            continueTrace = this.hitBlock(coords.x, coords.y, onBlock);
            coords = this.lineTrace.step();
        }
        this.lastTrace2.set(lastTrace2);
    }

    private hitBlock(x: number, y: number, onBlock: BlockHandler) {
        const block = this.map[y * this.numCols + x];
        if (!block || block.traceCount === this.traceCount) {
            return true; // continue tracing
        }
        this.lastTrace.val.push({ row: y, col: x });
        block.traceCount = this.traceCount;
        this.blockBounds.top = y * gridSize + this.bounds.bottom;
        this.blockBounds.left = x * gridSize + this.bounds.left;
        this.blockBounds.right = this.blockBounds.left + gridSize;
        this.blockBounds.bottom = this.blockBounds.top + gridSize;
        return onBlock(block, this.blockBounds);
    }

    traceBox(start: Vector3, vel: Vector3, radius: number, onBlock: BlockHandler) {
        this.lastTrace.set([]);
        lastTrace2.start.copy(start);
        lastTrace2.end.copy(start).add(vel);

        // if vel.x or vel.y is 0 (vertical/horizontal line) we still need to find leading corners so choose a value
        const dx = vel.x ? Math.sign(vel.x) : 1;
        const dy = vel.y ? Math.sign(vel.y) : 1;
        // choose the three leading corners of the AABB based on vel and radius and trace those simultaneously.
        // it's a rather complicate function though... it would be nice to simplify it (somehow)
        let ccw = this.ccwTrace.init(start.x + radius * dx, start.y - radius * dy, vel);
        let mid = this.mTrace.init(start.x + radius * dx, start.y + radius * dy, vel);
        let cw = this.cwTrace.init(start.x - radius * dx, start.y + radius * dy, vel);

        this.traceCount += 1;
        let continueTrace = true;
        while (mid && continueTrace) {
            if (mid) {
                continueTrace = this.hitBlock(mid.x, mid.y, onBlock);
            }
            if (ccw && continueTrace) {
                continueTrace = this.hitBlock(ccw.x, ccw.y, onBlock);
            }
            if (cw && continueTrace) {
                continueTrace = this.hitBlock(cw.x, cw.y, onBlock);
            }

            if (ccw && mid && continueTrace) {
                // fill in the gaps between ccw and mid corners
                for (let i = Math.min(ccw.x, mid.x); continueTrace && i < Math.max(mid.x, ccw.x); i++) {
                    continueTrace = this.hitBlock(i, mid.y, onBlock);
                }
                for (let i = Math.min(ccw.y, mid.y); continueTrace && i < Math.max(mid.y, ccw.y); i++) {
                    continueTrace = this.hitBlock(mid.x, i, onBlock);
                }
            }

            if (cw && mid && continueTrace) {
                // fill in the gaps between mid and cw corners
                for (let i = Math.min(cw.x, mid.x); continueTrace && i < Math.max(mid.x, cw.x); i++) {
                    continueTrace = this.hitBlock(i, mid.y, onBlock);
                }
                for (let i = Math.min(cw.y, mid.y); continueTrace && i < Math.max(mid.y, cw.y); i++) {
                    continueTrace = this.hitBlock(mid.x, i, onBlock);
                }
            }

            ccw = this.ccwTrace.step() ?? ccw;
            mid = this.mTrace.step();
            cw = this.cwTrace.step() ?? cw;
        }
    }

    radiusTrace(start: Vector3, radius: number, onBlock: (block: Block) => void) {
        const dx = Math.floor(radius / gridSize);
        const x1 = Math.floor((start.x - this.bounds.left) / gridSize);
        const y1 = Math.floor((start.y - this.bounds.bottom) / gridSize);
        const x2 = Math.min(this.numCols, x1 + dx);
        const y2 = Math.min(this.numRows, y1 + dx);

        let lastTrace = [];
        for (let x = Math.max(0, x1 - dx); x <= x2; x++) {
            for (let y = Math.max(0, y1 - dx); y <= y2; y++) {
                lastTrace.push({ row: y, col: x });
                onBlock(this.map[y * this.numCols + x]);
            }
        }
        this.lastTrace.set(lastTrace);
    }

    traceBounds(left: number, bottom: number, right: number, top: number, onBlock: (block: Block) => void) {
        const x1 = Math.max(0, Math.floor((left - this.bounds.left) / gridSize));
        const y1 = Math.max(0, Math.floor((bottom - this.bounds.bottom) / gridSize));
        const x2 = Math.min(this.numCols, Math.floor((right - this.bounds.left) / gridSize));
        const y2 = Math.min(this.numRows, Math.floor((top - this.bounds.bottom) / gridSize));
        for (let x = x1; x <= x2; x++) {
            for (let y = y1; y <= y2; y++) {
                onBlock(this.map[y * this.numCols + x]);
            }
        }
    }

    private queryIndex(x: number, y: number) {
        const inBounds = (
            x >= this.bounds.left && x <= this.bounds.right
            && y >= this.bounds.bottom && y <= this.bounds.top
        );
        if (!inBounds) {
            return -1;
        }
        const col = Math.floor((x - this.bounds.left) / gridSize);
        const row = Math.floor((y - this.bounds.bottom) / gridSize);
        return row * this.numCols + col;
    }
}

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
        this.blockmap = new BlockMap(wad.raw[index + 10].contents, this.linedefs);
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

    trace(start: Vector3, move: Vector3, onHit: HandleTraceHit) {
        return this.traceBlock(start, move, 0, onHit);
    }

    traceBlock(start: Vector3, move: Vector3, radius: number, onHit: HandleTraceHit) {
        this.bspTracer(start, move, radius, onHit);

        // // TODO: an object pool may avoid the gc overhead of alloc/dealloc of items in the array
        // let hits: TraceHit[] = [];
        // // because we process each block iteratively, we may actually miss a hit from another block that
        // // would be the first hit. blockmap.traceRay() wouldn't do this but using that means that wider
        // // objects or objects close to the edge of a block will not work right. Something that would be nice
        // // to fix someday...
        // this.blockmap.traceBox(start, move, radius, (block, bounds) => {
        //     hits.length = 0;
        //     for (const linedef of block.linedefs) {
        //         // because linedefs cut through multiple blocks, we often visit the same linedef multiple times
        //         // maybe we can improve this using bsp?
        //         const hit = sweepAABBLine(start, radius, move, linedef.v);
        //         // this is a bit of a hack because we may detect a hit on the linedef that is outside the bounds of a block
        //         // and we miss valid collisions because of that. Also, the hit will be the center of the AABB which may not be
        //         // in the block (when a linedef is close to the edge of a block). With all the little hacks needed here I do
        //         // wonder if we are better using bsp instead of blockmaps for linedef (or seg) collisions
        //         const validHit = (hit
        //             && hit.x + radius >= bounds.left && hit.x - radius <= bounds.right
        //             && hit.y + radius >= bounds.top && hit.y - radius <= bounds.bottom);
        //         if (validHit) {
        //             const side = -Math.sign(signedLineDistance(linedef.v, start)) as -1 | 1;
        //             const point = new Vector3(hit.x, hit.y, start.z + move.z * hit.u);
        //             const overlap = aabbLineOverlap(point, radius, linedef);
        //             hits.push({ overlap, point, side, line: linedef, fraction: hit.u });
        //         }
        //     }

        //     for (const thing of block.things) {
        //         // FIXME: a thing only exists in one block but objects that are close to the edge should overlap multiple blocks
        //         // See also https://doomwiki.org/wiki/Flawed_collision_detection
        //         // If we fix this, we will perhaps trace the same thing multiple times (like linedefs above) so maybe some more
        //         // thought is needed here
        //         const hit = sweepAABBAABB(start, radius, move, thing.position.val, thing.info.radius);
        //         if (hit) {
        //             const point = new Vector3(hit.x, hit.y, start.z + move.z * hit.u);
        //             const ov = aabbAabbOverlap(point, radius, thing.position.val, thing.info.radius);
        //             hits.push({ point, overlap: ov.area, axis: ov.axis, fraction: hit.u, mobj: thing });
        //         }
        //     }

        //     // TODO: what about hitting floors?

        //     // sort hits items
        //     hits.sort((a, b) => {
        //         const dist = a.fraction - b.fraction;
        //         return Math.abs(dist) < 0.000001 ? b.overlap - a.overlap : dist;
        //     });

        //     for (let hit of hits) {
        //         const shouldContinue = onHit(hit);
        //         if (!shouldContinue) {
        //             return false;
        //         }
        //     }

        //     return true;
        // });
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
    const screenProjection = new Matrix4();
    const bboxMin = new Vector3();
    const bboxMax = new Vector3();
    const bbox = new Box3(bboxMin, bboxMax);
    const frustum = new Frustum();
    const camera = new PerspectiveCamera(72);
    camera.updateProjectionMatrix();

    return (start: Vector3, move: Vector3, radius: number, onHit: HandleTraceHit) => {
        // end.copy(move).normalize().multiplyScalar(radius).add(start);
        end.copy(move).add(start);
        let dline = [start, end];
        // camera.position.copy(start);
        // camera.lookAt(end);
        // camera.updateMatrixWorld();

        // screenProjection.identity().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        // frustum.setFromProjectionMatrix(screenProjection);

        const bboxFromSeg = (seg: Seg) => {
            bboxMin.set(Math.min(seg.vx1.x, seg.vx2.x), Math.min(seg.vx1.y, seg.vx2.y), camera.position.z - 1);
            bboxMax.set(Math.max(seg.vx1.x, seg.vx2.x), Math.max(seg.vx1.y, seg.vx2.y), camera.position.z + 1);
        };
        const bboxFromNode = (bounds: NodeBounds) => {
            bboxMin.set(bounds.left, bounds.top, camera.position.z - 1);
            bboxMax.set(bounds.right, bounds.bottom, camera.position.z + 1);
        };

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
                // if ('line' in hit) console.log('notify',hit.line.num,complete)
                if (complete) {
                    break;
                }
            }
            hits.length = 0;
        }

        let ht = 0;
        let st = 0;
        let st2 = 0;
        let it = 0;
        let sst = 0;
        let mt = 0;
        function visitNode(node: TreeNode | SubSector) {
            if (complete) {
                return;
            }

            if ('segs' in node) {
                sst++;
                for (const mobj of node.mobjs) {
                    if (complete) {
                        break;
                    }

                    const hit = sweepAABBAABB(start, radius, move, mobj.position.val, mobj.info.radius);
                    mt++;
                    if (hit) {
                        const point = new Vector3(hit.x, hit.y, start.z + move.z * hit.u);
                        const ov = aabbAabbOverlap(point, radius, mobj.position.val, mobj.info.radius);
                        hits.push({ point, mobj, overlap: ov.area, axis: ov.axis, fraction: hit.u, subsector: node });
                    }
                }
                for (const seg of node.segs) {
                    if (complete) {
                        break;
                    }

                    // const p = lineLineIntersect(dline, seg.linedef.v, true);
                    // it++;
                    // if (!p) {
                    //     continue;
                    // }

                    // let startSide = Math.sign(signedLineDistance(seg.linedef.v, start));
                    // let endSide = Math.sign(signedLineDistance(seg.linedef.v, end));
                    // st++;
                    // if (startSide === endSide) {
                    //     // we didn't cross the line
                    //     continue;
                    // }
                    // // if (side === seg.direction) {
                    // //     continue;
                    // // }
                    // // bboxFromSeg(seg);
                    // // if (!frustum.intersectsBox(bbox)) {
                    // //     continue;
                    // // }

                    // startSide = Math.sign(signedLineDistance(dline, seg.linedef.v[0]));
                    // endSide = Math.sign(signedLineDistance(dline, seg.linedef.v[1]));
                    // st2++;
                    // if (startSide === endSide) {
                    //     // we didn't cross the line
                    //     continue;
                    // }

                    // Allow trace to pass through back-to-front. This allows things, like a player, to move away from
                    // a wall if they are stuck as long as they move the same direction as the wall normal. The two sided
                    // line is more complicated but that is handled elsewhere because it impacts movement, not bullets or
                    // other traces.
                    // Doom2's MAP03 starts the player exactly against the wall. Without this, we would be stuck :(
                    segNormal.set(seg.vx2.y - seg.vx1.y, seg.vx1.x - seg.vx2.x, 0);
                    if (move.dot(segNormal) >= 0) {
                        continue;
                    }

                    const hit = sweepAABBLine(start, radius, move, seg.linedef.v);
                    ht++;
                    if (hit) {
                        const side = seg.direction ? 1 : -1;
                        const point = new Vector3(hit.x, hit.y, start.z + move.z * hit.u);
                        const overlap = aabbLineOverlap(point, radius, seg.linedef);
                        // console.log('hit',seg.linedef.num,[hit.u,overlap],[seg.direction,side])
                        hits.push({ overlap, point, side, line: seg.linedef, fraction: hit.u, subsector: node });
                    }
                }
                // if (hits.length > 5) {
                    notifyHits();
                // }
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

            // bboxFromNode(node.boundsRight);
            // if (frustum.intersectsBox(bbox)) {
            //     visitNode(node.childRight);
            // }
        }
        visitNode(root);
        notifyHits();
        // console.log('trace-end move:[sst,ht,it,st,st2,mt]',move.toArray(),[sst,ht,it,st,st2,mt])
    };
}