import { store, type Store } from "./store";
import type { DoomWad } from "./wad/doomwad";
import { Vector3 } from "three";
import { MapObject } from "./map-object";
import { circleCircleSweep, dot, lineCircleIntersect, lineCircleSweep, lineLineIntersect, normal, signedLineDistance, type Vertex } from "./math";
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
}

export interface TraceHit {
    fraction: number; // 0-1 of how far we moved along the desired path
    point: Vector3; // point of hit (maybe redundant because we can compute it from fraction and we don't use z anyway)
    side?: -1 | 1; // only for linedefs, did we hit front side (1) or back side (-1)
    hit: LineDef | Sector | MapObject; // either a wall, ceilng/floor, or thing
}
// return true to continue trace, false to stop
export type HandleTraceHit = (hit: TraceHit) => boolean;

export interface HandleCollision<Type> {
    (t: Type, side?: -1 | 1): boolean;
}
export function CollisionNoOp() { return false; }

const frac = (n: number) => (n % 1) + (n < 0 ? 1 : 0);

const leftSide = new Vector3();
const rightSide = new Vector3();
const velU = new Vector3();
const velUR = new Vector3();
const traceEnd = new Vector3();
const lastTrace2 = {
    start: new Vector3(),
    end: new Vector3(),
    tMaxX: 0,
    tMaxY: 0,
    tDeltaX: 0,
    tDeltaY: 0,
}
const gridSize = 128;
class BlockMap {
    private map: Block[] = [];
    private numCols: number;
    private numRows: number;
    readonly bounds: NodeBounds;
    private objMap = new Map<MapObject, Block>();

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
            things: [],
            linedefs: block.linedefs
                .filter((e, i) => e >= 0 && !(i === 0 && e === 0))
                .map(e => linedefs[e]),
        }));
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

    trace(position: Vector3, radius: number, vel: Vector3) {
        const unique = (e: any, i: number, arr: any[]) => e && arr.indexOf(e) === i;

        // TODO: this whole function needs a little more testing - especially for high velocity objects

        // trace the left and right bounds of the object along velocity vector, add in the end block,
        // and return the union of unique linedefs and things from the touched blocks in the blockmap
        velU.copy(vel).normalize();
        velUR.set(-velU.y, velU.x, velU.z);

        const endIndex = this.queryIndex(position.x + vel.x + radius, position.y + vel.y + radius);
        leftSide.copy(position).addScaledVector(velUR, -radius);
        rightSide.copy(position).addScaledVector(velUR, radius);
        const blocks = [
            (endIndex === -1) ? null : this.map[endIndex],
            ...this.pointTrace(leftSide, vel),
            ...this.pointTrace(rightSide, vel),
        ].filter(unique);

        // remove duplicates
        const linedefs = blocks.map(e => e.linedefs).flat().filter(unique);
        const things = blocks.map(e => e.things).flat().filter(unique);
        return { linedefs, things };
    }

    trace2(start: Vector3, vel: Vector3, onBlock: (block: Block, bounds: NodeBounds) => boolean) {
        // kind of like Doom's P_PathTraverse but based on
        // http://www.cse.yorku.ca/~amana/research/grid.pdf
        // and https://stackoverflow.com/questions/12367071
        lastTrace2.start.copy(start);
        lastTrace2.end.copy(start).add(vel);

        let lastTrace = [];
        let startX = (start.x - this.bounds.left) / gridSize;
        let startY = (start.y - this.bounds.bottom) / gridSize;
        let x = Math.floor(startX);
        let y = Math.floor(startY);
        const sx = Math.sign(vel.x);
        const sy = Math.sign(vel.y);
        if (sx === 0 && sy === 0) {
            return;
        }
        let tDeltaX = Math.abs(gridSize / vel.x);
        let tDeltaY = Math.abs(gridSize / vel.y);
        let tMaxX = tDeltaX * (vel.x < 0 ? frac(startX) : 1 - frac(startX));
        let tMaxY = tDeltaY * (vel.y < 0 ? frac(startY) : 1 - frac(startY));

        lastTrace2.tDeltaX = tDeltaX;
        lastTrace2.tDeltaY = tDeltaY;
        lastTrace2.tMaxX = tMaxX;
        lastTrace2.tMaxY = tMaxY;
        let bounds: NodeBounds = { top: 0, left: 0, bottom: 0, right: 0 };
        let continueTrace = true;
        while (continueTrace) {
            const inBounds = x >= 0 && x <= this.numCols && y >= 0 && y <= this.numRows;
            if (!inBounds) {
                break;
            }
            lastTrace.push({ row: y, col: x });
            bounds.top = y * gridSize + this.bounds.bottom;
            bounds.left = x * gridSize + this.bounds.left;
            bounds.right = bounds.left + gridSize;
            bounds.bottom = bounds.top + gridSize;
            continueTrace = onBlock(this.map[y * this.numCols + x], bounds);

            if (tMaxX > 1 && tMaxY > 1) {
                break;
            }
            if (tMaxX < tMaxY) {
                tMaxX = tMaxX + tDeltaX;
                x = x + sx;
            } else {
                tMaxY = tMaxY + tDeltaY;
                y = y + sy;
            }
        }
        this.lastTrace.set(lastTrace);
        this.lastTrace2.set(lastTrace2);
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

    private pointTrace(start: Vector3, move: Vector3) {
        // this is close to Doom's P_PathTraverse but based on
        // http://playtechs.blogspot.com/2007/03/raytracing-on-grid.html
        let x = Math.floor(start.x);
        let y = Math.floor(start.y);

        const dt_dx = 1.0 / Math.abs(move.x);
        const dt_dy = 1.0 / Math.abs(move.y);

        let n = 1;
        let x_inc: number, y_inc: number;
        let vNext: number, hNext: number;

        if (move.x === 0) {
            x_inc = 0;
            hNext = dt_dx; // infinity
        } else if (move.x > 0) {
            x_inc = 1;
            n += Math.floor(start.x + move.x) - x;
            hNext = (Math.floor(start.x) + 1 - start.x) * dt_dx;
        } else {
            x_inc = -1;
            n += x - Math.floor(start.x + move.x);
            hNext = (start.x - Math.floor(start.x)) * dt_dx;
        }

        if (move.y === 0) {
            y_inc = 0;
            vNext = dt_dy; // infinity
        } else if (move.y > 0) {
            y_inc = 1;
            n += Math.floor(start.y + move.y) - y;
            vNext = (Math.floor(start.y) + 1 - start.y) * dt_dy;
        } else {
            y_inc = -1;
            n += y - Math.floor(start.y + move.y);
            vNext = (start.y - Math.floor(start.y)) * dt_dy;
        }

        let blocks: Block[] = [];
        for (; n > 0; --n) {
            const index = this.queryIndex(x, y);
            if (index !== -1) {
                blocks.push(this.map[index]);
            }

            if (vNext < hNext) {
                y += y_inc;
                vNext += dt_dy;
            } else {
                x += x_inc;
                hNext += dt_dx;
            }
        }
        return blocks;
    }

    private queryIndex(x: number, y: number) {
        const inBounds = (
            x >= this.bounds.left && x <= this.bounds.right
            && y >= this.bounds.bottom && y <= this.bounds.top
        );
        if (!inBounds) {
            return -1;
        }
        const col = Math.floor((x - this.bounds.left) / 128);
        const row = this.numRows - Math.ceil((-y + this.bounds.top) / 128);
        return row * this.numCols + col;
    }
}

const distSqr = (p1: Vertex, p2: Vertex) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return dx * dx + dy * dy;
};

const hittableThing = MFFlags.MF_SOLID | MFFlags.MF_SPECIAL | MFFlags.MF_SHOOTABLE;
const start = new Vector3();
const end = new Vector3();
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
        const segs: Seg[]  = wad.raw[index + 5].contents.entries.map(e => toSeg(e, this.vertexes, this.linedefs));
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

    xyCollisions(mobj: MapObject, move: Vector3, onThing: HandleCollision<MapObject>, onLinedef: HandleCollision<LineDef>, onSpecial: HandleCollision<LineDef>) {
        const maxStepSize = 24;

        start.copy(mobj.position.val);
        end.copy(start).add(move);

        let complete = false;
        const bquery = this.blockmap.trace(start, mobj.info.radius, move);
        for (let i = 0; i < bquery.linedefs.length && !complete; i++) {
            collideLine(bquery.linedefs[i]);
        }
        for (let i = 0; i < bquery.things.length && !complete; i++) {
            collideThing(bquery.things[i]);
        }

        function triggerSpecial(linedef: LineDef) {
            if (linedef.special) {
                const startSide = signedLineDistance(linedef.v, start) < 0 ? -1 : 1;
                const endSide = signedLineDistance(linedef.v, end) < 0 ? -1 : 1
                if (startSide !== endSide) {
                    onSpecial(linedef, endSide);
                }
            }
        }

        function collideThing(obj2: MapObject) {
            // kind of like PIT_CheckThing
            if (obj2 === mobj) {
                // don't collide with yourself
                return;
            }
            if (!(obj2.info.flags & hittableThing)) {
                // not hittable
                return;
            }

            const hit = circleCircleSweep(
                obj2.position.val, obj2.info.radius,
                start, mobj.info.radius, move);
            if (!hit) {
                return;
            }
            complete = !onThing(obj2);
        }

        function collideLine(linedef: LineDef) {
            const twoSided = (linedef.flags & 0x0004) !== 0;
            const blocking = (linedef.flags & 0x0001) !== 0;
            // FIXME: this condition isn't right. See the yellow key lift in E1M7, because of the normal we walk through the wall :(
            if (!blocking || !twoSided) {
                // don't collide if the direction is going from back to front
                // const side = signedLineDistance(linedef.v, start) < 0 ? -1 : 1;
                // if (side < 0) {
                const n = normal(linedef.v);
                if (dot(n, move) < 0) {

                    // TODO: make this cleaner? we already chek for collision and trigger special below
                    const hit = lineCircleSweep(linedef.v, move, start, mobj.info.radius);
                    if (hit) {
                        triggerSpecial(linedef);
                    }
                    return;
                }
            }

            const hit = lineCircleSweep(linedef.v, move, start, mobj.info.radius);
            if (!hit) {
                return;
            }

            if (twoSided && !blocking) {
                const changeDir = signedLineDistance(linedef.v, start);
                const endSect = changeDir > 0 ? linedef.left.sector : linedef.right.sector;

                const floorChangeOk = (endSect.zFloor.val - start.z <= maxStepSize);
                const transitionGapOk = (endSect.zCeil.val - start.z >= mobj.info.height);
                const newCeilingFloorGapOk = (endSect.zCeil.val - endSect.zFloor.val >= mobj.info.height);

                // console.log('[zz,f,t,cf]',[floorChangeOk,transitionGapOk,newCeilingFloorGapOk])
                if (newCeilingFloorGapOk && transitionGapOk && floorChangeOk) {
                    triggerSpecial(linedef);
                    return;
                }
            }

            if (signedLineDistance(linedef.v, end) > 0) {
                complete = !onLinedef(linedef)
            }
        }
    }

    trace(start: Vector3, dir: Vector3, onHit: HandleTraceHit) {
        const invVelLength = 1 / dir.length();
        traceEnd.copy(start).add(dir);
        const line = [start, traceEnd];
        // TODO: an object pool may avoid the gc overhead of alloc/dealloc of items in the array
        let hits: TraceHit[] = [];
        this.blockmap.trace2(start, dir, (block, bounds) => {
            hits.length = 0;
            for (const linedef of block.linedefs) {
                // because linedefs cut through multiple blocks, we actually may visit linedefs multiple times
                // maybe we can improve this using bsp?
                const hit = lineLineIntersect(line, linedef.v, true);
                // this is a bit of a hack because we may detect a hit on the linedef that is outside the bounds of a block
                // and we miss valid collisions because of that. With all the little hacks needed here... I wonder if we
                // are better using bsp instead of blockmaps for linedefs
                const validHit = (hit
                    && hit.x > bounds.left && hit.x < bounds.right
                    && hit.y > bounds.top && hit.y < bounds.bottom);
                if (validHit) {
                    const side = Math.sign(signedLineDistance(linedef.v, start)) as -1 | 1;
                    const fraction = Math.sqrt(distSqr(start, hit)) * invVelLength;
                    const point = new Vector3(hit.x, hit.y, start.z + dir.z * fraction);
                    hits.push({ fraction, point, side, hit: linedef });
                }
            }
            for (const thing of block.things) {
                // FIXME: a thing only exists in one block but objects that are close to the edge should overlap multiple blocks
                // See also https://doomwiki.org/wiki/Flawed_collision_detection
                // If we fix this, we will perhaps trace the same thing multiple times (like linedefs above) so maybe some more
                // thought is needed here

                // TODO: line-box intercept?
                const hit = lineCircleIntersect(line, thing.position.val, thing.info.radius);
                if (hit) {
                    const fraction = Math.sqrt(distSqr(start, hit[0])) * invVelLength;
                    const point = new Vector3(hit[0].x, hit[0].y, start.z + dir.z * fraction);
                    hits.push({ fraction, point, hit: thing });
                }
            }

            // TODO: what about hitting floors?

            // sort items from closest to farthest
            hits.sort((a, b) => a.fraction - b.fraction);

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
