export const HALF_PI = Math.PI * 0.5;
export const QUARTER_PI = Math.PI * 0.25;
export const EIGHTH_PI = Math.PI * 0.125;
export const ToRadians = Math.PI / 180;
export const ToDegrees = 180 / Math.PI;

export interface Vertex {
    x: number;
    y: number;
}

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

// some common vector functions
export const dot = (a, b) => a.x * b.x + a.y * b.y;
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

export function lineCircleSweep(l: Vertex[], dir: Vertex, cr: Vertex, r: number): Vertex | undefined {
    // Some great resources online (as one might expect)
    // this algorithm basically follows https://ericleong.me/research/circle-line/ but
    // https://stackoverflow.com/questions/7060519 was helpful too

    const end = { x: cr.x + dir.x, y: cr.y + dir.y };
    const i1 = lineCircleIntersect(l, end, r);
    if (i1) {
        return i1[0];
    }

    const vn = normalize(dir);
    const centerMove = [cr, end];

    const a = lineLineIntersect(l, centerMove);
    const b = closestPoint(l, centerMove[1]);
    const c = closestPoint(centerMove, l[0]);
    const d = closestPoint(centerMove, l[1]);

    if (a) {
        const p1 = closestPoint(l, cr);
        const lenAC = mag({ x: a.x - cr.x, y: a.y - cr.y });
        const lenP1C = mag({ x: p1.x - cr.x, y: p1.y - cr.y });
        const p2 = {
            x: a.x - r * (lenAC / lenP1C) * vn.x,
            y: a.y - r * (lenAC / lenP1C) * vn.y,
        }

        const pc = closestPoint(l, p2);
        if (pointOnLine(pc, l) && pointOnLine(p2, centerMove)) {
            return p2;
        }

        const bDist = mag({ x: b.x - centerMove[1].x, y: b.y - centerMove[1].y });
        if (bDist <= r && pointOnLine(b, l)) {
            const x = Math.sqrt(r * r - bDist * bDist);
            return {
                x: b.x - x * vn.x,
                y: b.y - x * vn.y,
            };
        }
    }

    const cDist = mag({ x: c.x - l[0].x, y: c.y - l[0].y });
    if (cDist <= r  && pointOnLine(c, centerMove)) {
        const x = Math.sqrt(r * r - cDist * cDist);
        return {
            x: c.x - x * vn.x,
            y: c.y - x * vn.y,
        };
    }

    const dDist = mag({ x: d.x - l[1].x, y: d.y - l[1].y });
    if (dDist <= r && pointOnLine(d, centerMove)) {
        const x = Math.sqrt(r * r - dDist * dDist);
        return {
            x: d.x - x * vn.x,
            y: d.y - x * vn.y,
        };
    }

    return undefined;
}

export function circleCircleSweep(c1: Vertex, r1: number, c2: Vertex, r2: number, dir: Vertex): Vertex | undefined {
    // https://ericleong.me/research/circle-circle/
    const move = [c2, { x: c2.x + dir.x, y: c2.y + dir.y }];
    const d = closestPoint(move, c1);
    const dist = mag({ x: c1.x - d.x, y: c1.y - d.y });
    const dist2 = mag({ x: move[1].x - c1.x, y: move[1].y - c1.y });
    const r = r1 + r2;
    if (dist <= r && (pointOnLine(d, move) || dist2 <= r)) {
        const dn = normalize(dir);
        const x = Math.sqrt(r * r - dist * dist);
        const c = {
            x: d.x - x * dn.x,
            y: d.y - x * dn.y,
        }
        return c;
    }
    return undefined;
}

export function pointOnLine(p: Vertex, l: Vertex[]) {
    const sd = signedLineDistance(l, p);
    return (
        sd > -0.0001 && sd < 0.0001 &&
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