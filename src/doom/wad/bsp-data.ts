import type { LineDef, Seg, SubSector, TreeNode } from "../map-data";
import { QuadTree, xyDistSqr, type Bounds, type Vertex } from "../math";
import { int16, word, type Lump } from "./wadfile";
import { readBspData as readZDoomBspData } from "./bsp-zdoom";

export type BSPData = { segs: Seg[], subsectors: SubSector[], nodes: TreeNode[] };

export function readBspData(mapLumps: Lump[], vertexes: Vertex[], linedefs: LineDef[]): BSPData {
    // special bsp nodes like XNOD (or zdoom extended nodes) or DeeP nodes https://doomwiki.org/wiki/Node_builder
    if ('XNOD' === String.fromCharCode(...mapLumps[7].data.subarray(0, 4))) {
        // TODO: also ZNOD for compressed nodes?
        return readZDoomBspData(mapLumps, vertexes, linedefs);
    }
    if ('xNd4' === String.fromCharCode(...mapLumps[7].data.subarray(0, 4))) {
        throw new Error('invalid lump: DeeP nodes not yet supported');
    }

    const segs = segsLump(mapLumps[5], vertexes, linedefs);
    const subsectors = subSectorLump(mapLumps[6], segs);
    const nodes = bspNodesLump(mapLumps[7], vertexes, subsectors);
    return { segs, nodes, subsectors };
}

function segsLump(lump: Lump, vertexes: Vertex[], linedefs: LineDef[]) {
    const len = 12;
    const num = Math.trunc(lump.data.length / len);
    if (num * len !== lump.data.length) {
        throw new Error('invalid lump: SEGS');
    }
    let segs = new Array<Seg>(num);
    for (let i = 0; i < num; i++) {
        const v0 = int16(word(lump.data, 0 + i * len));
        const v1 = int16(word(lump.data, 2 + i * len));
        const v = [vertexes[v0], vertexes[v1]];
        // re-compute this angle because the integer angle (-32768 -> 32767) was not precise enough
        // (if we don't do this, we get walls that sometimes are little bit misaligned in E1M1 - and many other places)
        const angle = Math.atan2(
            vertexes[v1].y - vertexes[v0].y,
            vertexes[v1].x - vertexes[v0].x,
        );
        const linedefId = int16(word(lump.data, 6 + i * len));
        const linedef = linedefs[linedefId];
        const direction = int16(word(lump.data, 8 + i * len));
        segs[i] = { v, angle, linedef, direction };
    }
    return segs;
}

// this bounds will never be true when testing for collisions because if something
// is bigger than left, it will be less than right and fail (same for top and bottom)
const _invalidBounds: Bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };

function subSectorLump(lump: Lump, segs: Seg[]) {
    const len = 4;
    const num = Math.trunc(lump.data.length / len);
    if (num * len !== lump.data.length) {
        throw new Error('invalid lump: SSECTORS');
    }
    let subsectors = new Array<SubSector>(num);
    for (let i = 0; i < num; i++) {
        const segCount = int16(word(lump.data, 0 + i * len));
        const segId = int16(word(lump.data, 2 + i * len));
        subsectors[i] = {
            num: i,
            sector: segs[segId].direction
                ? segs[segId].linedef.left.sector
                : segs[segId].linedef.right.sector,
            segs: segs.slice(segId, segId + segCount),
            mobjs: new Set(),
            hitC: 0,
            // bounds and vertexes will be populated by completeSubSectors()
            bounds: _invalidBounds,
            vertexes: [],
            bspLines: [],
         };
    }
    return subsectors;
}

function bspNodesLump(lump: Lump, vertexes: Vertex[], subsectors: SubSector[]) {
    const len = 28;
    const num = Math.trunc(lump.data.length / len);
    if (num * len !== lump.data.length) {
        throw new Error('invalid lump: NODES');
    }
    let nodes = new Array<TreeNode>(num);
    for (let i = 0; i < num; i++) {
        let xStart = int16(word(lump.data, 0 + i * len));
        let yStart = int16(word(lump.data, 2 + i * len));
        let xChange = int16(word(lump.data, 4 + i * len));
        let yChange = int16(word(lump.data, 6 + i * len));
        const childRight: any = int16(word(lump.data, 24 + i * len));
        const childLeft: any = int16(word(lump.data, 26 + i * len));
        nodes[i] = {
            childRight, childLeft,
            v: [
                { x: xStart, y: yStart },
                { x: xStart + xChange, y: yStart + yChange },
            ],
        };
    }
    const qt = new QuadTree(5);
    for (const v of vertexes) {
        qt.insert(v);
    }

    nodes.forEach(node => {
        fixBSPLine(node, qt);
        node.childLeft = assignChild(node.childLeft, nodes, subsectors);
        node.childRight = assignChild(node.childRight, nodes, subsectors);
    });

    return nodes;
}

function assignChild(child: TreeNode | SubSector, nodes: TreeNode[], ssector: SubSector[]) {
    let idx = (child as any) as number;
    return (idx & 0xa000)
        ? ssector[idx & 0x7fff]
        : nodes[idx & 0x7fff];
};

function fixBSPLine(node: TreeNode, qt: QuadTree<Vertex>) {
    // adjust bsp lines based on map vertexes (similar to map-data fixVertexes())
    let closest = closestVertex(node.v[0], qt);
    node.v[0].x = closest.x;
    node.v[0].y = closest.y;

    closest = closestVertex(node.v[1], qt);
    node.v[1].x = closest.x;
    node.v[1].y = closest.y;
}

function closestVertex(p: Vertex, qt: QuadTree<Vertex>) {
    let dist = Infinity;
    let closest = p;
    qt.query(p, v => {
        let d = xyDistSqr(p, v);
        if (d < dist) {
            dist = d;
            closest = v;
        }
    });
    return closest;
}
