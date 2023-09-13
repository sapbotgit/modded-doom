import { ClampToEdgeWrapping, Color, DataTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import {
    pointOnLine,
    closestPoint,
    centerSort,
    signedLineDistance,
    lineLineIntersect,
    type DoomWad,
    type TreeNode,
    type Seg,
    type Vertex,
    type SubSector,
    type Sector,
    MapRuntime,
    MapData,
} from "../doom";
import { sineIn } from 'svelte/easing';

// all flats (floors/ceilings) are 64px
const flatRepeat = 1 / 64;

export class MapTextures {
    private cache = new Map<string, Texture>();
    private lightCache = new Map<number, Color>;

    // TODO: array of doom wads for pwads?
    constructor(readonly wad: DoomWad) {
        const maxLight = 255;
        for (let i = 0; i < maxLight + 1; i++) {
            // scale light using a curve to make it look more like doom
            const light = Math.floor(sineIn(i / maxLight) * maxLight);
            this.lightCache.set(i, new Color(light | light << 8 | light << 16));
        }
    }

    get(name: string, type: 'wall' | 'flat' | 'sprite') {
        const cacheKey = type[0] + name;
        let texture = this.cache.get(cacheKey);
        if (texture === undefined && name) {
            const loadFn = type === 'wall' ? 'wallTextureData' :
                type === 'flat' ? 'flatTextureData' :
                'spriteTextureData';
            const data = this.wad[loadFn](name);
            if (data) {
                const buffer = new Uint8ClampedArray(data.width * data.height * 4);
                data.toBuffer(buffer);
                texture = new DataTexture(buffer, data.width, data.height)
                texture.wrapS = RepeatWrapping;
                texture.wrapT = RepeatWrapping;
                texture.flipY = true;
                texture.needsUpdate = true;
                texture.colorSpace = SRGBColorSpace;
                texture.userData = {
                    width: data.width,
                    height: data.height,
                    xOffset: data.xOffset,
                    yOffset: data.yOffset,
                    invWidth: 1 / data.width,
                    invHeight: 1 / data.height,
                }

                if (type === 'sprite') {
                    // don't wrap sprites
                    texture.wrapS = ClampToEdgeWrapping;
                    texture.wrapT = ClampToEdgeWrapping;
                }

                if (type === 'flat') {
                    // flats don't need extra positioning (because doom floors are aligned to grid)
                    // so configure the texture here so we don't need to clone to set offset
                    texture.repeat.set(flatRepeat, flatRepeat);
                }
            } else {
                texture = null;
            }
            this.cache.set(cacheKey, texture);
        }
        if (!texture) {
            console.warn('missing', type, name, type)
        }
        return texture;
    }

    // TODO: find a better place for this
    lightColor(light: number) {
        return this.lightCache.get(Math.max(0, Math.min(255, light)));
    }
}

export interface RenderSector {
    sector: Sector;
    vertexes: Vertex[];
    segs: Seg[];
    // TODO: MapObjects so we only render them if the sector is visible?
    // these are only helpful for debugging. Maybe we can remove them?
    subsec: SubSector;
    bspLines: Vertex[][];
}

export function buildRenderSectors(map: MapData) {
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

    visitNode(map.nodes[map.nodes.length - 1]);
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
