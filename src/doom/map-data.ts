import { store, type Store } from "./store";
import type { DoomWad } from "./wad/doomwad";
import { Vector3 } from "three";
import { MapObject } from "./map-object";
import { AmanatidesWooTrace, signedLineDistance, sweepAABBAABB, sweepAABBLine, type Vertex } from "./math";
import { MFFlags } from "./doom-things-info";
import type { GameTime } from "./game";

export type Action = (time: GameTime) => void;

export interface Thing {
    x: number;
    y: number;
    z?: number;
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
}
const toSubSector = (item: any, segs: Seg[]): SubSector => ({
    sector: segs[item.firstSeg].direction ? segs[item.firstSeg].linedef.left.sector : segs[item.firstSeg].linedef.right.sector,
    segs: segs.slice(item.firstSeg, item.firstSeg + item.count),
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

    radiusTrace(start: Vector3, radius: number, onBlock: (block: Block) => boolean) {
        const dx = Math.floor(radius / gridSize);
        const x1 = Math.floor((start.x - this.bounds.left) / gridSize);
        const y1 = Math.floor((start.y - this.bounds.bottom) / gridSize);
        const x2 = x1 + dx;
        const y2 = y1 + dx;

        let lastTrace = [];
        for (let x = x1 - dx; x <= x2; x++) {
            for (let y = y1 - dx; y <= y2; y++) {
                lastTrace.push({ row: y, col: x });
                onBlock(this.map[y * this.numCols + x]);
            }
        }
        this.lastTrace.set(lastTrace);
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

const _moveEnd = new Vector3();
const hittableThing = MFFlags.MF_SOLID | MFFlags.MF_SPECIAL | MFFlags.MF_SHOOTABLE;
export class MapData {
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

    private findSubSector(x: number, y: number): SubSector {
        let node: TreeNode | SubSector = this.nodes[this.nodes.length - 1];
        while (true) {
            if ('segs' in node) {
                return node;
            }
            // is Left https://stackoverflow.com/questions/1560492
            const cross = (node.v[1].x - node.v[0].x) * (y - node.v[0].y) - (node.v[1].y - node.v[0].y) * (x - node.v[0].x);
            if (cross <= 0) {
                node = node.childRight;
            } else {
                node = node.childLeft
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

    xyCollisions(mobj: MapObject, move: Vector3, onHit: HandleTraceHit) {
        const maxStepSize = 24;

        _moveEnd.copy(mobj.position.val).add(move);
        function triggerSpecial(hit: LineTraceHit) {
            if (hit.line.special) {
                const startSide = signedLineDistance(hit.line.v, start) < 0 ? -1 : 1;
                const endSide = signedLineDistance(hit.line.v, _moveEnd) < 0 ? -1 : 1
                if (startSide !== endSide) {
                    onHit({ ...hit, special: true });
                }
            }
        }

        const start = mobj.position.val;
        this.traceBlock(start, move, mobj.info.radius, hit => {
            if ('mobj' in hit) {
                // kind of like PIT_CheckThing
                if (hit.mobj === mobj) {
                    return true; // don't collide with yourself
                }
                if (!(hit.mobj.info.flags & hittableThing)) {
                    return true; // not hittable
                }
                return onHit(hit);
            } else if ('line' in hit) {
                const twoSided = (hit.line.flags & 0x0004) !== 0;
                const blocking = (hit.line.flags & 0x0001) !== 0;
                if (twoSided && !blocking) {
                    const endSect = hit.side < 0 ? hit.line.left.sector : hit.line.right.sector;

                    const floorChangeOk = (endSect.zFloor.val - start.z <= maxStepSize);
                    const transitionGapOk = (endSect.zCeil.val - start.z >= mobj.info.height);
                    const newCeilingFloorGapOk = (endSect.zCeil.val - endSect.zFloor.val >= mobj.info.height);
                    const dropOffOk =
                        (mobj.info.flags & (MFFlags.MF_DROPOFF | MFFlags.MF_FLOAT)) ||
                        (start.z - endSect.zFloor.val <= maxStepSize);

                    // console.log('[sz,ez], [f,t,cf,do]',[start.z, endSect.zFloor.val], [floorChangeOk,transitionGapOk,newCeilingFloorGapOk,dropOffOk])
                    if (newCeilingFloorGapOk && transitionGapOk && floorChangeOk && dropOffOk) {
                        triggerSpecial(hit);
                        return true; // step/ceiling collision is okay so try next line
                    }
                }

                return onHit(hit);
            }
        });
    }

    trace(start: Vector3, move: Vector3, onHit: HandleTraceHit) {
        return this.traceBlock(start, move, 0, onHit);
    }

    private traceBlock(start: Vector3, move: Vector3, radius: number, onHit: HandleTraceHit) {
        // TODO: an object pool may avoid the gc overhead of alloc/dealloc of items in the array
        let hits: TraceHit[] = [];
        this.blockmap.traceBox(start, move, radius, (block, bounds) => {
            hits.length = 0;
            for (const linedef of block.linedefs) {
                // because linedefs cut through multiple blocks, we actually may visit linedefs multiple times
                // maybe we can improve this using bsp?
                const hit = sweepAABBLine(start, radius, move, linedef.v);
                // this is a bit of a hack because we may detect a hit on the linedef that is outside the bounds of a block
                // and we miss valid collisions because of that. Also, the hit will be the center of the AABB which may not be
                // in the block (when a linedef is close to the edge of a block). With all the little hacks needed here I do
                // wonder if we are better using bsp instead of blockmaps for linedef (or seg) collisions
                const validHit = (hit
                    && hit.x + radius > bounds.left && hit.x - radius < bounds.right
                    && hit.y + radius > bounds.top && hit.y - radius < bounds.bottom);
                if (validHit) {
                    const side = -Math.sign(signedLineDistance(linedef.v, start)) as -1 | 1;
                    const point = new Vector3(hit.x, hit.y, start.z + move.z * hit.u);
                    const overlap = aabbLineOverlap(start, radius, linedef);
                    hits.push({ overlap, point, side, line: linedef, fraction: hit.u });
                }
            }

            for (const thing of block.things) {
                // FIXME: a thing only exists in one block but objects that are close to the edge should overlap multiple blocks
                // See also https://doomwiki.org/wiki/Flawed_collision_detection
                // If we fix this, we will perhaps trace the same thing multiple times (like linedefs above) so maybe some more
                // thought is needed here
                const hit = sweepAABBAABB(start, radius, move, thing.position.val, thing.info.radius);
                if (hit) {
                    const point = new Vector3(hit.x, hit.y, start.z + move.z * hit.u);
                    const overlap = aabbAabbOverlap(start, radius, thing.position.val, thing.info.radius);
                    hits.push({ overlap, point, fraction: hit.u, mobj: thing });
                }
            }

            // TODO: what about hitting floors?

            // sort hits items
            hits.sort((a, b) => (a.fraction === b.fraction)
                    ? b.overlap - a.overlap : a.fraction - b.fraction);

            for (let hit of hits) {
                const shouldContinue = onHit(hit);
                if (!shouldContinue) {
                    return false;
                }
            }

            return true;
        });
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
    const area =
        (Math.min(boxMaxX, lineMaxX) - Math.max(boxMinX, lineMinX)) *
        (Math.min(boxMaxY, lineMaxY) - Math.max(boxMinY, lineMinY));
    return Math.max(0, area);
}

function aabbAabbOverlap(p1: Vector3, r1: number, p2: Vector3, r2: number) {
    const b1MinX = p1.x - r1;
    const b1MaxX = p1.x + r1;
    const b1MinY = p1.y - r1;
    const b1MaxY = p1.y + r1;
    const b2MinX = p2.x - r2;
    const b2MaxX = p2.x + r2;
    const b2MinY = p2.y - r2;
    const b2MaxY = p2.y + r2;
    const area =
        (Math.min(b1MaxX, b2MaxX) - Math.max(b1MinX, b2MinX)) *
        (Math.min(b1MaxY, b2MaxY) - Math.max(b1MinY, b2MinY));
    return Math.max(0, area);
}
