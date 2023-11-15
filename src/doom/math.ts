export const HALF_PI = Math.PI / 2;
export const QUARTER_PI = Math.PI / 4;
export const EIGHTH_PI = Math.PI / 8;
export const ToRadians = Math.PI / 180;
export const ToDegrees = 180 / Math.PI;

export interface Vertex {
    x: number;
    y: number;
}
const dot = (a: Vertex, b: Vertex) => a.x * b.x + a.y * b.y;

export interface Bounds {
    top: number;
    left: number;
    bottom: number;
    right: number;
}

interface IntersectionPoint extends Vertex {
    u: number; // distance from point1 to point2 of the impact (0-1)
}

export const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
// larger radius means less noise
export const angleNoise = (radius: number) => (Math.random() - Math.random()) * (Math.PI / radius);

export function signedLineDistance(l: Vertex[], v: Vertex) {
    // https://math.stackexchange.com/questions/274712
    // https://www.xarg.org/book/linear-algebra/2d-perp-product/
    return (v.x - l[0].x) * (l[1].y - l[0].y) - (v.y - l[0].y) * (l[1].x - l[0].x)
}

// more memory efficient to not allocate new objects all the time
const lineLineIntersectionDetails = {
    x: 0, y: 0,
    u: 0, v: 0,
    inBounds: function() {
        return !(this.v < 0 || this.v > 1 || this.u < 0 || this.u > 1);
    }
}
function lineLineIntersectDetailed(l1: Vertex[], l2: Vertex[]): typeof lineLineIntersectionDetails | undefined {
    // fantastic article https://observablehq.com/@toja/line-box-intersection
    // wikipidia was helpful too https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection#Given_two_points_on_each_line_segment
    const x1x2 = l1[0].x - l1[1].x, y1y2 = l1[0].y - l1[1].y,
        x1x3 = l1[0].x - l2[0].x, y1y3 = l1[0].y - l2[0].y,
        x3x4 = l2[0].x - l2[1].x, y3y4 = l2[0].y - l2[1].y;

    const d =  x1x2 * y3y4 - y1y2 * x3x4;
    // parallel or coincident
    if (d === 0) {
        return undefined;
    }

    lineLineIntersectionDetails.u = (x1x3 * y3y4 - y1y3 * x3x4) / d;
    lineLineIntersectionDetails.v = -(x1x2 * y1y3 - y1y2 * x1x3) / d;
    lineLineIntersectionDetails.x = l1[0].x + lineLineIntersectionDetails.u * (l1[1].x - l1[0].x);
    lineLineIntersectionDetails.y = l1[0].y + lineLineIntersectionDetails.u * (l1[1].y - l1[0].y);
    return lineLineIntersectionDetails;
}

export function lineLineIntersect(l1: Vertex[], l2: Vertex[], bounded = false): IntersectionPoint | undefined {
    const details = lineLineIntersectDetailed(l1, l2);
    return (!details || (bounded && !details.inBounds()))
        ? undefined : details;
}


export function pointOnLine(p: Vertex, l: Vertex[]) {
    const sd = signedLineDistance(l, p);
    return (
        sd > -0.00001 && sd < 0.00001 &&
        Math.min(l[0].x, l[1].x) <= p.x && p.x <= Math.max(l[0].x, l[1].x) &&
        Math.min(l[0].y, l[1].y) <= p.y && p.y <= Math.max(l[0].y, l[1].y)
    );
}

export function closestPoint(l: Vertex[], p: Vertex): Vertex {
    let A1 = l[1].y - l[0].y;
    let B1 = l[0].x - l[1].x;
    let det = A1 * A1 + B1 * B1;
    if (det === 0) {
        return p;
    } else {
        let C1 = A1 * l[0].x + B1 * l[0].y;
        let C2 = -B1 * p.x + A1 * p.y;
        return {
            x: (A1 * C1 - B1 * C2) / det,
            y: (A1 * C2 + B1 * C1) / det,
        };
    }
}

export function centerSort(verts: Vertex[]) {
    // sort points in CCW order https://stackoverflow.com/questions/6989100
    let center = { x: 0, y: 0 };
    for (const v of verts) {
        center.x += v.x;
        center.y += v.y;
    }
    center.x /= verts.length;
    center.y /= verts.length;

    return verts
        .sort((a, b) => {
            let acx = a.x - center.x, bcx = b.x - center.x,
                acy = a.y - center.y, bcy = b.y - center.y;
            if (acx >= 0 && bcx < 0) return -1;
            if (acx < 0 && bcx >= 0) return 1;
            if (acx == 0 && bcx == 0) {
                return (acy >= 0 || bcy >= 0) ? b.y - a.y : a.y - b.y;
            }

            // cross product
            let det = acx * bcy - bcx * acy;
            if (det < 0) {
                return -1;
            } else if (det > 0) {
                return 1;
            }
            // sort by distance to center
            let d1 = acx * acx + acy * acy;
            let d2 = bcx * bcx + bcy * bcy;
            return d1 - d2;
        });
}

const PIx2 = Math.PI * 2;
// Angle between 0 and 2PI
// https://stackoverflow.com/questions/2320986
export const normalizeAngle = (angle: number) => Math.PI + angle - (Math.floor((angle + Math.PI) / PIx2)) * PIx2;

let _sweepZeroLine = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
]
let _sweepVec = { x: 0, y: 0, u: 0 };
let _sweepLineNormal = { x: 0, y: 0 };
export function sweepAABBLine(position: Vertex, radius: number, velocity: Vertex, line: Vertex[]): IntersectionPoint {
    // adaptaion of the code from this question:
    // https://gamedev.stackexchange.com/questions/29479

    if (radius < 0.001) {
        // when AABB "radius" is 0, we are basically testing a line from position to position+velocity against another
        // line so do that test instead because this one gets some rounding errors when radius is 0.
        _sweepZeroLine[0].x = position.x;
        _sweepZeroLine[0].y = position.y;
        _sweepZeroLine[1].x = position.x + velocity.x;
        _sweepZeroLine[1].y = position.y + velocity.y;
        return lineLineIntersect(_sweepZeroLine, line, true) as any;
    }

    // form an AABB using position and radius
    const boxMinX = position.x - radius;
    const boxMaxX = position.x + radius;
    const boxMinY = position.y - radius;
    const boxMaxY = position.y + radius;

    _sweepLineNormal.x = line[0].y - line[1].y;
    _sweepLineNormal.y = line[1].x - line[0].x;
    let invVelProj = 1 / dot(velocity, _sweepLineNormal); //projected Velocity to N
    _sweepVec.x = line[0].x - position.x;
    _sweepVec.y = line[0].y - position.y;
    let boxProj = dot(_sweepVec, _sweepLineNormal); //projected Line distance to N

    let r = radius * Math.abs(_sweepLineNormal.x) + radius * Math.abs(_sweepLineNormal.y); //radius to Line
    if (invVelProj < 0) {
        r = -r;
    }

    let hitTime = Math.max((boxProj - r) * invVelProj, 0);
    let outTime = Math.min((boxProj + r) * invVelProj, 1);

    // X axis overlap
    const lineMinX = Math.min(line[0].x, line[1].x);
    const lineMaxX = Math.max(line[0].x, line[1].x);
    if (velocity.x < 0) { // Sweep left
        if (boxMaxX < lineMinX) { return null; }
        hitTime = Math.max((lineMaxX - boxMinX) / velocity.x, hitTime);
        outTime = Math.min((lineMinX - boxMaxX) / velocity.x, outTime);
    } else if (velocity.x > 0) { // Sweep right
        if (boxMinX > lineMaxX) { return null; }
        hitTime = Math.max((lineMinX - boxMaxX) / velocity.x, hitTime);
        outTime = Math.min((lineMaxX - boxMinX) / velocity.x, outTime);
    } else {
        if (lineMinX > boxMaxX || lineMaxX < boxMinX) { return null; }
    }

    // Y axis overlap
    const lineMinY = Math.min(line[0].y, line[1].y);
    const lineMaxY = Math.max(line[0].y, line[1].y);
    if (velocity.y < 0) { // Sweep down
        if (boxMaxY < lineMinY) { return null; }
        hitTime = Math.max((lineMaxY - boxMinY) / velocity.y, hitTime);
        outTime = Math.min((lineMinY - boxMaxY) / velocity.y, outTime);
    } else if (velocity.y > 0) { // Sweep up
        if (boxMinY > lineMaxY) { return null; }
        hitTime = Math.max((lineMinY - boxMaxY) / velocity.y, hitTime);
        outTime = Math.min((lineMaxY - boxMinY) / velocity.y, outTime);
    } else {
        if (lineMinY > boxMaxY || lineMaxY < boxMinY) { return null; }
    }

    if (hitTime > outTime) {
        return null;
    }

    // collision happened, return point of impact
    _sweepVec.x = position.x + velocity.x * hitTime;
    _sweepVec.y = position.y + velocity.y * hitTime;
    _sweepVec.u = hitTime;
    return _sweepVec;
}

let _sweepAABB = { x: 0, y: 0, u: 0 };
export function sweepAABBAABB(
    p1: Vertex, r1: number, v1: Vertex,
    p2: Vertex, r2: number,
    bounded = true,
): IntersectionPoint {
    // FIXME: is there a bug here? We do sometimes get stuck in monsters and now that we have AI, monsters seem to
    // get stuck to each other. I wonder if this is related to the NaN check in lineBounds. Maybe we can unify these?

    // test if already overlapping
    const left = (p2.x - r2) - (p1.x + r1);
    const right = (p2.x + r2) - (p1.x - r1);
    const top = (p2.y + r2) - (p1.y - r1);
    const bottom = (p2.y - r2) - (p1.y + r1);
    if (left < 0 && right > 0 && top > 0 && bottom < 0) {
        _sweepAABB.x = p1.x;
        _sweepAABB.y = p1.y;
        _sweepAABB.u = 0;
        return _sweepAABB;
    }

    // test sweeping aabb (based on https://www.amanotes.com/post/using-swept-aabb-to-detect-and-process-collision)
    const dxEntry = (v1.x < 0) ? right : left;
    const dxExit = (v1.x < 0) ? left : right;
    const dyEntry = (v1.y < 0) ? top : bottom;
    const dyExit = (v1.y < 0) ? bottom : top;

    const txEntry = dxEntry / v1.x;
    const txExit = dxExit / v1.x;
    const tyEntry = dyEntry / v1.y;
    const tyExit = dyExit / v1.y;
    const tEntry = Math.max(txEntry, tyEntry);
    const tExit = Math.min(txExit, tyExit);
    if (tEntry > tExit) {
        return null;
    }
    if (bounded && ((txEntry < 0 && tyEntry < 0) || txEntry > 1 || tyEntry > 1)) {
        return null;
    }

    _sweepAABB.x = p1.x + v1.x * tEntry;
    _sweepAABB.y = p1.y + v1.y * tEntry;
    _sweepAABB.u = tEntry;
    return _sweepAABB;
}

let _lineAABB2 = [
    { x: 0, y: 0, u: 0 },
    { x: 0, y: 0, u: 0 },
];
export function lineBounds(line: Vertex[], bounds: Bounds) {
    // hmmm.. this function is very similar to sweepAABBAABB.. maybe we can combine them?
    const left = bounds.left - line[0].x;
    const right = bounds.right - line[0].x;
    const top = bounds.top - line[0].y;
    const bottom = bounds.bottom - line[0].y;
    const vx = line[1].x - line[0].x;
    const vy = line[1].y - line[0].y;

    // test sweeping aabb (based on https://www.amanotes.com/post/using-swept-aabb-to-detect-and-process-collision)
    const dxEntry = (vx < 0) ? right : left;
    const dxExit = (vx < 0) ? left : right;
    const dyEntry = (vy < 0) ? bottom : top;
    const dyExit = (vy < 0) ? top : bottom;

    const txEntry = dxEntry / vx;
    const txExit = dxExit / vx;
    const tyEntry = dyEntry / vy;
    const tyExit = dyExit / vy;
    let tEntry =
        isNaN(txEntry) ? tyEntry :
        isNaN(tyEntry) ? txEntry :
        Math.max(txEntry, tyEntry);
    let tExit =
        isNaN(txExit) ? tyExit :
        isNaN(tyExit) ? txExit :
        Math.min(txExit, tyExit);
    if (tEntry > tExit || tExit < 0 || tEntry > 1) {
        return null;
    }

    tEntry = Math.max(0, tEntry);
    tExit = Math.min(1, tExit);
    _lineAABB2[0].x = line[0].x + vx * tEntry;
    _lineAABB2[0].y = line[0].y + vy * tEntry;
    _lineAABB2[0].u = tEntry;
    _lineAABB2[1].x = line[0].x + vx * tExit;
    _lineAABB2[1].y = line[0].y + vy * tExit;
    _lineAABB2[1].u = tExit;
    return _lineAABB2;
}

let _lineAABB = { x: 0, y: 0 };
export function lineAABB(line: Vertex[], pos: Vertex, radius: number, bounded = true) {
    _lineAABB.x = line[1].x - line[0].x;
    _lineAABB.y = line[1].y - line[0].y;
    // we can get lineAABB using sweep and setting the box radius to 0
    return sweepAABBAABB(line[0], 0, _lineAABB, pos, radius, bounded);
}
