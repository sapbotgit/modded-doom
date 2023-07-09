import type { Vertex } from "../doomwad";

export const HALF_PI = Math.PI * 0.5;
export const QUARTER_PI = Math.PI * 0.25;
export const EIGHTH_PI = Math.PI * 0.125;
export const ToRadians = Math.PI / 180;
export const ToDegrees = 180 / Math.PI;

export function signedLineDistance(l: Vertex[], v: Vertex) {
    // https://math.stackexchange.com/questions/274712
    // https://www.xarg.org/book/linear-algebra/2d-perp-product/
    return (v.x - l[0].x) * (l[1].y - l[0].y) - (v.y - l[0].y) * (l[1].x - l[0].x)
}

export function intersectionPoint(l1: Vertex[], l2: Vertex[]): Vertex | undefined {
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

    const t = (x1x3 * y3y4 - y1y3 * x3x4) / d;
    const u = -(x1x2 * y1y3 - y1y2 * x1x3) / d;
    const outsideSegment = false; // t < 0 || t > 1 || u < 0 || u > 1;
    return outsideSegment ? undefined : {
        x: l1[0].x + t * (l1[1].x - l1[0].x),
        y: l1[0].y + t * (l1[1].y - l1[0].y)
    };
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