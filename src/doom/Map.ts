import { get, writable, type Writable } from "svelte/store";
import type { DoomWad } from "./doomwad";
import { Vector3 } from "three";
import { PlayerMapObject, MapObject } from "./MapObject";
import { centerSort, circleCircleSweep, closestPoint, dot, lineCircleSweep, lineLineIntersect, normal, pointOnLine, signedLineDistance } from "./Math";
import { MFFlags } from "./doom-things-info";

type ThingType = number;

export interface Thing {
    x: number;
    y: number;
    angle: number;
    type: ThingType;
    flags: number;
}

export interface LineDef {
    v: Vertex[];
    flags: number;
    special: number;
    tag: number;
    right?: SideDef;
    left?: SideDef;
    // derived
    xOffset?: Writable<number>;
}
const toLineDef = (ld: any, vertexes: Vertex[], sidedefs: SideDef[]): LineDef => ({
    v: [vertexes[ld.vertexStartIdx], vertexes[ld.vertexEndIdx]],
    left: sidedefs[ld.sidedefLeftIdx],
    right: sidedefs[ld.sidedefRightIdx],
    tag: ld.sectorTag,
    special: ld.lineType,
    flags: ld.flags,
});

export interface SideDef {
    xOffset: Writable<number>;
    yOffset: Writable<number>;
    sector: Sector;
    upper: Writable<string>;
    lower: Writable<string>;
    middle: Writable<string>;
}
const toSideDef = (sd: any, sectors: Sector[], textures: Map<string, Writable<string>>): SideDef => ({
    xOffset: writable(sd.offsetX),
    yOffset: writable(sd.offsetY),
    sector: sectors[sd.sectorId],
    lower: textures.get(fixTextureName(sd.lowerTextureName)),
    middle: textures.get(fixTextureName(sd.normalTextureName)),
    upper: textures.get(fixTextureName(sd.upperTextureName)),
});

function fixTextureName(name: string) {
    return !name || name.startsWith('-') ? undefined : name.split('\u0000')[0];
}

export interface Vertex {
    x: number;
    y: number;
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
    tag: number;
    type: number;
    source: {
        zFloor: number;
        zCeil: number;
        light: number;
        floorFlat: string;
        ceilFlat: string;
    };
    values: {
        zFloor: number;
        zCeil: number;
        light: number;
        floorFlat: string;
        ceilFlat: string;
    }
    zFloor: Writable<number>;
    zCeil: Writable<number>;
    light: Writable<number>;
    floorFlat: Writable<string>;
    ceilFlat: Writable<string>;
    specialData: any;
}
const toSector = (sd: any, textures: Map<string, Writable<string>>): Sector => {
    const sector = {
        source: {
            zFloor: sd.floorZ,
            zCeil: sd.ceilZ,
            light: sd.light,
            floorFlat: fixTextureName(sd.floorFlat),
            ceilFlat: fixTextureName(sd.ceilFlat),
        },
        values: {
            zFloor: sd.floorZ,
            zCeil: sd.ceilZ,
            light: sd.light,
            floorFlat: fixTextureName(sd.floorFlat),
            ceilFlat: fixTextureName(sd.ceilFlat),
        },
        tag: sd.tag,
        type: sd.specialType,
        zFloor: writable(sd.floorZ),
        zCeil: writable(sd.ceilZ),
        light: writable(sd.light),
        floorFlat: textures.get(fixTextureName(sd.floorFlat)),
        ceilFlat: textures.get(fixTextureName(sd.ceilFlat)),
        specialData: null,
    };
    // so we don't need to use get() on critical code paths (like collision detection)
    sector.zFloor.subscribe(v => sector.values.zFloor = v);
    sector.zCeil.subscribe(v => sector.values.zCeil = v);
    sector.light.subscribe(v => sector.values.light = v);
    sector.floorFlat.subscribe(v => sector.values.floorFlat = v);
    sector.ceilFlat.subscribe(v => sector.values.ceilFlat = v);
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

export interface AnimatedTexture {
    frames: string[];
    current: number;
    speed: number;
    target: Writable<string>;
}

interface Block {
    linedefs: LineDef[];
    things: MapObject[];
}

interface HandleCollision<Type> {
    (t: Type): boolean;
}
export function CollisionNoOp() { return false; }

const leftSide = new Vector3();
const rightSide = new Vector3();
const velU = new Vector3();
const velUR = new Vector3();
class BlockMap {
    private map: Block[] = [];
    private numCols: number;
    private numRows: number;
    readonly bounds: NodeBounds;
    private objMap = new Map<MapObject, Block>();

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
        mobj.position.subscribe(pos => {
            const oldBlock = this.objMap.get(mobj);
            const idx = this.queryIndex(pos.x, pos.y);
            if (idx === -1) {
                console.warn('invalid block', pos);
                return;
            }
            const newBlock = this.map[idx];
            if (oldBlock === newBlock) {
                return;
            }

            // TODO: perf improvement with array manipulation?
            if (oldBlock) {
                oldBlock.things = oldBlock.things.filter(e => e !== mobj);
            }
            newBlock.things.push(mobj);
            this.objMap.set(mobj, newBlock);
        });
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

const hittableThing = MFFlags.MF_SOLID | MFFlags.MF_SPECIAL | MFFlags.MF_SHOOTABLE;
const start = new Vector3();
const end = new Vector3();
export class DoomMap {
    readonly name: string;
    readonly things: Thing[];
    readonly linedefs: LineDef[];
    readonly vertexes: Vertex[];
    readonly sectors: Sector[];
    readonly nodes: TreeNode[];
    readonly renderSectors: RenderSector[];
    readonly blockmap: BlockMap;
    objs: MapObject[];

    readonly animatedTextures: AnimatedTexture[] = [];

    constructor(readonly wad: DoomWad, index) {
        this.name = wad.raw[index].name;

        // optimization: use a single writeable per texture name
        const wallTextures = new Map<string, Writable<string>>();
        for (const sidedef of wad.raw[index + 3].contents.entries) {
            const lower = fixTextureName(sidedef.lowerTextureName);
            const middle = fixTextureName(sidedef.normalTextureName);
            const upper = fixTextureName(sidedef.upperTextureName);
            wallTextures.set(lower, writable(lower));
            wallTextures.set(middle, writable(middle));
            wallTextures.set(upper, writable(upper));
        }
        const flatTextures = new Map<string, Writable<string>>();
        for (const sector of wad.raw[index + 8].contents.entries) {
            const floorFlat = fixTextureName(sector.floorFlat);
            const ceilFlat = fixTextureName(sector.ceilFlat);
            flatTextures.set(floorFlat, writable(floorFlat));
            flatTextures.set(ceilFlat, writable(ceilFlat));
        }

        this.things = wad.raw[index + 1].contents.entries;
        this.sectors = wad.raw[index + 8].contents.entries.map(s => toSector(s, flatTextures));
        this.vertexes = wad.raw[index + 4].contents.entries;
        const sidedefs: SideDef[] = wad.raw[index + 3].contents.entries.map(e => toSideDef(e, this.sectors, wallTextures));
        this.linedefs = wad.raw[index + 2].contents.entries.map(e => toLineDef(e, this.vertexes, sidedefs));
        const segs: Seg[]  = wad.raw[index + 5].contents.entries.map(e => toSeg(e, this.vertexes, this.linedefs));
        const subsectors: SubSector[] = wad.raw[index + 6].contents.entries.map(e => toSubSector(e, segs));
        this.nodes = wad.raw[index + 7].contents.entries.map(d => toNode(d));
        this.nodes.forEach(n => {
            n.childLeft = assignChild(n.childLeft, this.nodes, subsectors);
            n.childRight = assignChild(n.childRight, this.nodes, subsectors);
        });
        this.objs = this.things.map(e => this.spawn(e)).filter(e => e);
        this.blockmap = new BlockMap(wad.raw[index + 10].contents, this.linedefs);
        this.objs.forEach(o => this.blockmap.watch(o));

        // apply animations only to the cached textures
        for (const texture of flatTextures.values()) {
            this.initializeTextureAnimation(wad, texture, 'animatedFlatInfo');
        }
        for (const texture of wallTextures.values()) {
            this.initializeTextureAnimation(wad, texture, 'animatedWallInfo');
        }

        // must be after fixing segs
        this.renderSectors = buildRenderSectors(this.nodes);
    }

    private initializeTextureAnimation(wad: DoomWad, target: Writable<string>, animInfoFn: 'animatedWallInfo' | 'animatedFlatInfo') {
        // wall/flat animations are all 8 ticks each
        const speed = 8;
        target.subscribe(v => {
            const animInfo = wad[animInfoFn](v);
            if (animInfo) {
                this.animatedTextures.push({ frames: animInfo[1], current: animInfo[0], target, speed });
            }
        })();
    }

    spawn(thing: Thing): MapObject | undefined {
        if (thing.type === 1) {
            return new PlayerMapObject(this, thing);
        }
        const noSpawn = (false
            || thing.type === 2
            || thing.type === 3
            || thing.type === 4
            || thing.type === 11
            || thing.type === 14
            || thing.type === 87
            || thing.type === 89
        );
        if (noSpawn) {
            return;
        }
        if (thing.flags & 0x0010) {
            return; // multiplayer only
        }
        return new MapObject(this, thing);
    }

    findSubSector(x: number, y: number): SubSector {
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

    xyCollisions(obj: MapObject, move: Vector3, onThing: HandleCollision<MapObject>, onLinedef: HandleCollision<LineDef>) {
        const maxStepSize = 24;

        const pos = get(obj.position);
        start.set(pos.x, pos.y, pos.z);
        end.copy(start).add(move);

        let complete = false;
        const bquery = this.blockmap.trace(start, obj.spec.mo.radius, move);
        for (let i = 0; i < bquery.linedefs.length && !complete; i++) {
            collideLine(bquery.linedefs[i]);
        }
        for (let i = 0; i < bquery.things.length && !complete; i++) {
            collideThing(bquery.things[i]);
        }

        function collideThing(obj2: MapObject) {
            // kind of like PIT_CheckThing
            if (obj2 === obj) {
                // don't collide with yourself
                return;
            }
            if (!(obj2.spec.mo.flags & hittableThing)) {
                // not hittable
                return;
            }
            if (obj2.spec.mo.flags & MFFlags.MF_SPECIAL && !(obj2.spec.mo.flags & MFFlags.MF_SOLID)) {
                // item can be picked up so don't block
                return;
            }

            const hit = circleCircleSweep(
                get(obj2.position) as Vertex, obj2.spec.mo.radius,
                start, obj.spec.mo.radius, move);
            if (!hit) {
                return;
            }
            complete = !onThing(obj2);
        }

        function collideLine(linedef: LineDef) {
            const twoSided = (linedef.flags & 0x0004) !== 0;
            const blocking = (linedef.flags & 0x0001) !== 0;
            if (!blocking || !twoSided) {
                // don't collide if the direction is going from back to front
                const n = normal(linedef.v);
                if (dot(n, move) <= 0) {
                    return;
                }
            }

            const hit = lineCircleSweep(linedef.v, move, start, obj.spec.mo.radius);
            if (!hit) {
                return;
            }

            if (twoSided && !blocking) {
                const changeDir = signedLineDistance(linedef.v, start);
                const endSec = changeDir > 0 ? linedef.left.sector : linedef.right.sector;
                const startSec = changeDir > 0 ? linedef.right.sector : linedef.left.sector;

                const floorChangeOk = (endSec.values.zFloor - startSec.values.zFloor <= maxStepSize);
                const ceilingFloorGapOk = (endSec.values.zCeil - endSec.values.zFloor >= obj.spec.mo.height);

                if (ceilingFloorGapOk && floorChangeOk) {
                    return;
                }
                // TODO: trigger edges that were walked over?
            }

            if (signedLineDistance(linedef.v, end) > 0) {
                complete = !onLinedef(linedef)
            }
        }
    }
}

export interface RenderSector {
    sector: Sector;
    vertexes: Vertex[];
    segs: Seg[];
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
            const vertexes = subsectorVerts(child.segs, bspLines);
            sectors.push({ sector, vertexes, segs: child.segs, subsec: child, bspLines: [...bspLines] })
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

    visitNode(nodes[nodes.length - 1]);
    return sectors;
}

function subsectorVerts(segs: Seg[], bspLines: Vertex[][]) {
    fixSegs(segs);
    // explicit points
    let segLines = segs.map(e => [e.vx1, e.vx2]);
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
                verts.push(point);
            }
        }
    }
    return centerSort(verts)
}

function fixSegs(segs: Seg[]) {
    for (const seg of segs) {
        if (!pointOnLine(seg.vx1, seg.linedef.v)) {
            seg.vx1 = closestPoint(seg.linedef.v, seg.vx1);
        }
        if (!pointOnLine(seg.vx2, seg.linedef.v)) {
            seg.vx2 = closestPoint(seg.linedef.v, seg.vx2);
        }

        // re-compute this angle because the integer angle (-32768 -> 32767) was not precise enough
        // (if we don't do this, we get walls that sometimes are little bit misaligned in E1M1 - and many other places)
        seg.angle = Math.atan2(seg.vx2.y - seg.vx1.y, seg.vx2.x - seg.vx1.x);
    }
}