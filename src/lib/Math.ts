import type { Vertex } from "../doomwad";

export const HALF_PI = Math.PI * 0.5;
export const QUARTER_PI = Math.PI * 0.25;
export const EIGHTH_PI = Math.PI * 0.125;
export const ToRadians = Math.PI / 180;
export const ToDegrees = 180 / Math.PI;

export const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min)) + min;

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

export function lineLineIntersect(l1: Vertex[], l2: Vertex[], bounded = false): Vertex | undefined {
    const details = lineLineIntersectDetailed(l1, l2);
    return (!details || (bounded && !details.inBounds()))
        ? undefined : { x: details.x, y: details. y };
}

export function lineCircleIntersect(l: Vertex[], c: Vertex, r: number): Vertex[] | undefined {
    // http://paulbourke.net/geometry/circlesphere/index.html#linesphere
    // https://stackoverflow.com/questions/5883169
    let x2x1 = l[1].x - l[0].x, y2y1 = l[1].y - l[0].y;

    let A = x2x1 * x2x1 + y2y1 * y2y1;
    let B = 2 * (x2x1 * (l[0].x - c.x) + y2y1 * (l[0].y - c.y));
    let C = (c.x * c.x) + (c.y * c.y)
        + (l[0].x * l[0].x) + (l[0].y * l[0].y)
        - 2 * (c.x * l[0].x + c.y * l[0].y)
        - (r * r);

    let D = B * B - 4 * A * C;
    if (D < 0) {
        return;
    }

    let sqrtD = Math.sqrt(D);
    let u = (-B - sqrtD) / (2 * A);
    let v = (-B + sqrtD) / (2 * A);
    if ((u < 0 && v < 0) || (u > 1 && v > 1)) {
        return;
    }

    let s1 = {
        x: l[0].x + u * x2x1,
        y: l[0].y + u * y2y1,
    };
    if (D === 0) {
        return [s1];
    }

    let s2 = {
        x: l[0].x + v * x2x1,
        y: l[0].y + v * y2y1,
    };
    return [s1, s2];
}

// Define some common functions for working with vectors
const add = (a, b) => ({x: a.x + b.x, y: a.y + b.y});
const sub = (a, b) => ({x: a.x - b.x, y: a.y - b.y});
export const dot = (a, b) => a.x * b.x + a.y * b.y;
const hypot2 = (a, b) => dot(sub(a, b), sub(a, b));
// Function for projecting some vector a onto b
function proj(a, b) {
    const k = dot(a, b) / dot(b, b);
    return {x: k * b.x, y: k * b.y};
}

const mag = (v: Vertex) => Math.sqrt(v.x * v.x + v.y * v.y);
const normalize = (v: Vertex) => {
    const len = mag(v);
    const invLen = len > 0 ? 1 / len : 0;
    return { x: v.x * invLen, y: v.y * invLen };
}
export const normal = (l: Vertex[]) => {
    const n = normalize({ x: l[1].x - l[0].x, y: l[1].y - l[0].y });
    return { x: -n.y, y: n.x };
}

const lineCircleSweepDetails = {
    x: 0, y: 0,
    dn: { x:0, y:0 },
    cn: { x:0, y:0 },
    n: {x:0,y:0},
    a: {x:0,y:0},
    b: {x:0,y:0},
    c: {x:0,y:0},
    d: {x:0,y:0},
    edgeL: {x:0,y:0},
    edgeR: {x:0,y:0},
}
export function lineCircleSwee3(l: Vertex[], dir: Vertex, c: Vertex, r: number): typeof lineCircleSweepDetails | undefined {
    // Some great resources online (as one might expect)
    // https://stackoverflow.com/questions/7060519 and https://ericleong.me/research/circle-line/
    // were helpful to me
    // TODO: we can probably be more efficient here... lots of sqrts and new objects for vector math

    // const dlen = vlen(dir);
    // if (dlen < r) {
    //     // small movement (less than circle radius) so handle that differently
    //     const pts = lineCircleIntersect(l, c ,r);
    //     if (pts) {
    //         lineCircleSweepDetails.x = pts[0].x
    //         lineCircleSweepDetails.y = pts[0].y
    //         return lineCircleSweepDetails
    //     } else {
    //         return undefined;
    //     }
    // }

    // normal to the line
    const n = normal(l);
    lineCircleSweepDetails.n = n;
    if (dot(n, dir) > 0) {
        // flip the normal if the lines are in opposite direction
        n.x = -n.x;
        n.y = -n.y;
    }
    // the point on the edge of the circle that will hit the line based on the normal
    const p = { x: c.x - n.x * r, y: c.y - n.y * r };
    // circle path based on the point above. The line intersection gives us the point
    // on the circle that will hit the line
    const l1 = [p, { x: p.x + dir.x, y: p.y + dir.y }];

    // check if the circle hits the line
    let details = lineLineIntersectDetailed(l, l1);
    if (details && details.inBounds()) {
        lineCircleSweepDetails.x = details.x + n.x * r;
        lineCircleSweepDetails.y = details.y + n.y * r;
        return lineCircleSweepDetails;
    }

    // maybe the line hits the trajectory of the circle center?
    const centerMove = [c, { x: c.x + dir.x, y: c.y + dir.y }];
    const dn = normalize(dir);
    const cmn = normal(centerMove);
    lineCircleSweepDetails.dn = dn;
    lineCircleSweepDetails.cn = cmn;
    if (dot(cmn, { x: l[0].x - c.x, y: l[0].y - c.y }) > 0) {
        // flip the normal if the lines are in _the same_ directions
        cmn.x = -cmn.x;
        cmn.y = -cmn.y;
    }

    const ha = [l[0], { x: l[0].x + cmn.x * r, y: l[0].y + cmn.y * r }];
    details = lineLineIntersectDetailed(centerMove, ha);
    if (details && details.inBounds()) {
        const dist = mag({ x: l[0].x - details.x, y: l[0].y - details.y })
        const move = Math.sqrt(r * r - dist * dist);
        lineCircleSweepDetails.x = details.x - move * dn.x
        lineCircleSweepDetails.y = details.y - move * dn.y
        return lineCircleSweepDetails;
    }

    if (dot(cmn, { x: l[1].x - c.x, y: l[1].y - c.y }) > 0) {
        // flip the normal if the lines are in _the same_ directions
        cmn.x = -cmn.x;
        cmn.y = -cmn.y;
    }
    const hb = [l[1], { x: l[1].x + cmn.x * r, y: l[1].y + cmn.y * r }];
    details = lineLineIntersectDetailed(centerMove, hb);
    if (details && details.inBounds()) {
        const dist = mag({ x: l[1].x - details.x, y: l[1].y - details.y })
        const move = Math.sqrt(r * r - dist * dist);
        lineCircleSweepDetails.x = details.x - move * dn.x
        lineCircleSweepDetails.y = details.y - move * dn.y
        return lineCircleSweepDetails;
    }

    return undefined;
}
const l = [
    {x:0,y:0},
    {x:0,y:0},
]
// export function lineCircleSweep(l: Vertex[], dir: Vertex, cr: Vertex, r: number): typeof lineCircleSweepDetails | undefined {
export function lineCircleSweep(l: Vertex[], dir: Vertex, cr: Vertex, r: number): Vertex | undefined {
    // Some great resources online (as one might expect)
    // this algorithm basically follows https://ericleong.me/research/circle-line/ but
    // https://stackoverflow.com/questions/7060519 was helpful too

    const end = { x: cr.x + dir.x, y: cr.y + dir.y };
    const i1 = lineCircleIntersect(l, end, r);
    if (i1) {
        lineCircleSweepDetails.x = i1[0].x;
        lineCircleSweepDetails.y = i1[0].y;
        // return lineCircleSweepDetails;
        return i1[0]//lineCircleSweepDetails;
    }

    const vn = normalize(dir);
    const centerMove = [cr, end];

    const a = lineLineIntersect(l, centerMove);
    const b = closestPoint(l, centerMove[1]);
    const c = closestPoint(centerMove, l[0]);
    const d = closestPoint(centerMove, l[1]);
    lineCircleSweepDetails.a = a;
    lineCircleSweepDetails.b = b;
    lineCircleSweepDetails.c = c;
    lineCircleSweepDetails.d = d;

    // if (magV < r) {
    //     const i = lineCircleIntersect(l, end, r);
    //     if (i) {
    //         lineCircleSweepDetails.x = i[0].x;
    //         lineCircleSweepDetails.y = i[0].y;
    //         // return lineCircleSweepDetails;
    //         return i[0]//lineCircleSweepDetails;
    //     }
    // }

    // if (a && pointOnLine(a, l) && pointOnLine(a, centerMove)) {
    if (a) {
        const p1 = closestPoint(l, cr);
        const lenAC = mag({ x: a.x - cr.x, y: a.y - cr.y });
        const lenP1C = mag({ x: p1.x - cr.x, y: p1.y - cr.y });
        const p2 = {
            x: a.x - r * (lenAC / lenP1C) * vn.x,
            y: a.y - r * (lenAC / lenP1C) * vn.y,
        }

        const pc = closestPoint(l, p2);
        // const p3 = { x: p2.x + (p1.x - pc.x), y: p2.y + (p1.y - pc.y) }
        if (pointOnLine(pc, l) && pointOnLine(p2, centerMove)) {
            lineCircleSweepDetails.x = p2.x;
            lineCircleSweepDetails.y = p2.y;
            // return lineCircleSweepDetails;
            // console.log('a')
            return p2;
        }

        const bDist = mag({ x: b.x - centerMove[1].x, y: b.y - centerMove[1].y });
        const aDist = mag({ x: a.x - centerMove[1].x, y: a.y - centerMove[1].y });
        if (bDist <= r && pointOnLine(b, l)) {
            const x = Math.sqrt(r * r - bDist * bDist);
            lineCircleSweepDetails.x = b.x - x * vn.x;
            lineCircleSweepDetails.y = b.y - x * vn.y;
            // return lineCircleSweepDetails;
            // console.log('b')
            return {
                x: b.x - x * vn.x,
                y: b.y - x * vn.y,
            };
        }
    }

    // let cd = circleCircleSweep(l[0], 0, cr, r, dir);
    // if (cd) {
    //     return cd;
    // }
    // let dd = circleCircleSweep(l[1], 0, cr, r, dir);
    // if (dd) {
    //     return dd;
    // }
    const cDist = mag({ x: c.x - l[0].x, y: c.y - l[0].y });
    if (cDist <= r  && pointOnLine(c, centerMove)) {
        // return circleCircleSweep(l[0], 0, c, r, dir);
        const x = Math.sqrt(r * r - cDist * cDist);
        lineCircleSweepDetails.x = c.x - x * vn.x;
        lineCircleSweepDetails.y = c.y - x * vn.y;
        // return lineCircleSweepDetails;
        // console.log('c')
        return {
            x: c.x - x * vn.x,
            y: c.y - x * vn.y,
        };
    }

    const dDist = mag({ x: d.x - l[1].x, y: d.y - l[1].y });
    // console.log(dDist, pointOnLine(d, centerMove))
    if (dDist <= r && pointOnLine(d, centerMove)) {
        // return circleCircleSweep(l[1], 0, c, r, dir);
        const x = Math.sqrt(r * r - dDist * dDist);
        lineCircleSweepDetails.x = d.x - x * vn.x;
        lineCircleSweepDetails.y = d.y - x * vn.y;
        // return lineCircleSweepDetails;
        // console.log('d')
        return {
            x: d.x - x * vn.x,
            y: d.y - x * vn.y,
        };
    }

    lineCircleSweepDetails.x = -100;
    lineCircleSweepDetails.y = -100;
    return undefined;
}

export function lineCircleSweep2(l: Vertex[], dir: Vertex, cr: Vertex, r: number): typeof lineCircleSweepDetails | undefined {
// export function lineCircleSweep(l: Vertex[], dir: Vertex, cr: Vertex, r: number): Vertex | undefined {
    // Some great resources online (as one might expect)
    // this algorithm basically follows https://ericleong.me/research/circle-line/ but
    // https://stackoverflow.com/questions/7060519 was helpful too

    const magV = mag(dir);
    const centerMove = [cr, { x: cr.x + dir.x, y: cr.y + dir.y }];
    const vn = normalize(dir);
    const nl = normalize({ x: l[1].x - l[0].x, y: l[1].y - l[0].y });
    const n = normal(centerMove);
    // if (dot(n, dir) > 0) {
    //     // flip the normal if the lines are in opposite direction
    //     n.x = -n.x;
    //     n.y = -n.y;
    // }

    const edgeL = { x: cr.x - n.x * r, y: cr.y - n.y * r };
    const edgeR = { x: cr.x + n.x * r, y: cr.y + n.y * r };
    const R = [edgeR, { x: edgeR.x + dir.x, y: edgeR.y + dir.y }]
    const rp = lineLineIntersect(R, l, true)
    lineCircleSweepDetails.edgeL= edgeL;
    lineCircleSweepDetails.edgeR= edgeR;
    const L = [edgeL, { x: edgeL.x + dir.x, y: edgeL.y + dir.y }];
    const lp = lineLineIntersect(L, l, true)
    if (lp) {
        lineCircleSweepDetails.x = lp.x
        lineCircleSweepDetails.y = lp.y
        // return lineCircleSweepDetails;
        // return lp;
    }

    if (rp) {
        lineCircleSweepDetails.x = rp.x
        lineCircleSweepDetails.y = rp.y
        // return lineCircleSweepDetails;
        // return rp;

    }

    const edgeC = { x: cr.x + vn.x * r, y: cr.y + vn.y * r };
    const C = [edgeC, { x: edgeC.x + dir.x, y: edgeC.y + dir.y }];
    const cp = lineLineIntersect(C, l, true)
    if (cp) {
        lineCircleSweepDetails.x = cp.x
        lineCircleSweepDetails.y = cp.y
        return lineCircleSweepDetails;
        // return cp;

    }

    lineCircleSweepDetails.x = -1000;
    lineCircleSweepDetails.y = -1000;
    // return lineCircleSweepDetails;
    return undefined;
}

export function lineCircleSweep4(l: Vertex[], dir: Vertex, cr: Vertex, r: number): Vertex | undefined {
    // trying again... https://www.elliotcolp.com/magnaut/collision-detection
    const BA = { x: cr.x - l[0].x, y: cr.y - l[0].y };
    const BC = { x: l[1].x - l[0].x, y: l[1].y - l[0].y };
    const N = proj(BA, BC);
    const pN = { x: N.x + l[0].x, y: N.y + l[0].y };
    const nDist = mag({ x: pN.x - cr.x, y: pN.y - cr.y });
    if (nDist <= r && pointOnLine(pN, l)) {
        return pN;
    }

    const centerMove = [cr, { x: cr.x + dir.x, y: cr.y + dir.y }];
    const p = lineLineIntersect(centerMove, l);
    if (p) {
        const AN = { x: pN.x - cr.x, y: pN.y - cr.y };
        const an = normalize(AN);
        const s = proj(dir, an);
        const d = mag(AN) - r;
        const D = {
            x: cr.x + dir.x * (s.x / d),
            y: cr.y + dir.y * (s.y / d),
        };
        console.log(an, s, d, D);
        return D;
    }
    return undefined;
}

export function circleCircleSweep(c1: Vertex, r1: number, c2: Vertex, r2: number, dir: Vertex): Vertex | undefined {
    // https://ericleong.me/research/circle-circle/
    const move = [c2, { x: c2.x + dir.x, y: c2.y + dir.y }];
    const d = closestPoint(move, c1);
    const dist = mag({ x: c1.x - d.x, y: c1.y - d.y });
    const r = r1 + r2;
    if (dist <= r) {
        const dn = normalize(dir);
        const x = Math.sqrt(r * r - dist * dist);
        const c = {
            x: d.x - x * dn.x,
            y: d.y - x * dn.y,
        }
        return c;
    }

    // https://www.elliotcolp.com/magnaut/collision-detection
    // const dist = vlen({ x: c1.x - c2.x, y: c1.y - c2.y });
    // if (dist < r1 + r2) {
    //     return c2;
    // }

    // const m = [c2, { x: c2.x + dir.x, y: c2.y + dir.y }]
    // const p = closestPoint(m, c1)
    // const pDist = vlen({ x: c2.x + p.x, y: c2.y + p.y });
    // if (r1 + r2 <= pDist && pointOnLine(p, m)) {
    //     return c2;
    // }
    return undefined;
}

function pointOnLine(p: Vertex, l: Vertex[]) {
    // let cp = (p.y - l[0].y) * (l[1].x - l[0].x) - (p.x - l[0].x) * (l[1].y - l[0].y)
    const cp = signedLineDistance(l, p);
    return (
        cp > -0.0001 && cp < 0.0001 &&
        Math.min(l[0].x, l[1].x) <= p.x && p.x <= Math.max(l[0].x, l[1].x) &&
        Math.min(l[0].y, l[1].y) <= p.y && p.y <= Math.max(l[0].y, l[1].y)
    );
}

export function closestPoint(l: Vertex[], p: Vertex) {
    let A1 = l[1].y - l[0].y;
    let B1 = l[0].x - l[1].x;
    let C1 = A1 * l[0].x + (B1) * l[0].y;
    let C2 = -B1 * p.x + A1 * p.y;
    let det = A1 * A1 + B1 * B1;
    if (det === 0) {
        return p;
    } else{
        return {
            x: (A1 * C1 - B1 * C2) / det,
            y: (A1 * C2 + B1 * C1) / det,
        };
    }
}

export function centerSort(verts: Vertex[]) {
    // sort points in CCW order https://stackoverflow.com/questions/6989100
    let center = { x:0, y:0 };
    for (const v of verts) {
        center.x += v.x;
        center.y += v.y;
    }
    center.x /= verts.length;
    center.y /= verts.length;

    return verts
        .filter((v, i, arr) => arr.indexOf(v) === i)
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

// TODO: depend on FOV?
const viewSpan = HALF_PI + QUARTER_PI;
export function angleIsVisible(viewAngle: number, angle: number) {
    // https://gamedev.stackexchange.com/questions/4467
    const ang = normalizeAngle(viewAngle - angle);
    return (-viewSpan < ang && ang < viewSpan);
}

export function normalizeAngle(angle: number) {
    // https://gamedev.stackexchange.com/questions/4467
    return Math.PI - Math.abs(Math.abs(angle - HALF_PI) - Math.PI);
}