import { BufferGeometry, ClampToEdgeWrapping, Color, DataTexture, NearestFilter, RepeatWrapping, SRGBColorSpace, Shape, ShapeGeometry, type NormalBufferAttributes, type Texture } from "three";
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import {
    type DoomWad,
    type Seg,
    type SubSector,
    type Sector,
    MapData,
    type Vertex,
    type LineDef,
    type Store,
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
                texture.magFilter = NearestFilter;
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

    lightColor(light: number) {
        return this.lightCache.get(Math.max(0, Math.min(255, Math.floor(light))));
    }
}

export interface RenderSector {
    sector: Sector;
    subsectors: SubSector[];
    portalSegs: Seg[];
    linedefs: LineDef[];
    geometry: BufferGeometry<NormalBufferAttributes>;
    // TODO: MapObjects so we only render them if the sector is visible?

    // properties copied from sector. A self-referencing sector will use values from a neighbour sector (see below)
    zFloor: Store<number>;
    zCeil: Store<number>;
    floorFlat: Store<string>;
    ceilFlat: Store<string>;
    light: Store<number>;
}

export function buildRenderSectors(map: MapData) {
    let selfReferencing: RenderSector[] = [];
    let sectors: RenderSector[] = [];
    const allSubsectors = map.nodes.map(e => [e.childLeft, e.childRight]).flat().filter(e => 'segs' in e) as SubSector[];
    const allSegs = allSubsectors.map(e => e.segs).flat();
    for (const sector of map.sectors) {
        const subsectors = allSubsectors.filter(subsec => subsec.sector === sector);
        const portalSegs = allSegs.filter(seg => seg.direction === 0 && seg.linedef.left?.sector === sector);
        const geos = subsectors.map(subsec => createShape(subsec.vertexes));
        const linedefs = map.linedefs.filter(ld => ld.right.sector === sector);
        // E3M2 (maybe other maps) have sectors with no subsectors and therefore no vertexes. Odd.
        const geometry = geos.length ? BufferGeometryUtils.mergeGeometries(geos) : null;
        const { zFloor, zCeil, floorFlat, ceilFlat, light } = sector;
        const renderSector: RenderSector = { sector, subsectors, portalSegs, geometry, linedefs, zFloor, zCeil, floorFlat, ceilFlat, light };
        sectors.push(renderSector);

        // fascinating little render hack: self-referencing sector. Basically a sector where all lines are two-sided
        // and both sides refer to the same sector. For doom, that sector would be invisible but the renderer fills in the
        // floor and ceiling gaps magically. We can see the effect in Plutonia MAP02 (invisible bridge), MAP24 (floating cages),
        // MAP28 (brown sewage) and TNT MAP02 where the backpack is in "deep water".
        // https://doomwiki.org/wiki/Making_a_self-referencing_sector
        // https://doomwiki.org/wiki/Making_deep_water
        // FIXME: this doesn't fix the "transparent barriers" in TNT MAP02... how does sector 93 (plus 87, 89, and 95) work??
        const leftlines = map.linedefs.filter(ld => ld.left && ld.left.sector === sector);
        const selfref = leftlines.length && leftlines.every(ld => ld.right.sector === sector);
        if (selfref) {
            selfReferencing.push(renderSector);
        }
    }

    // copy render properties from the outer/containing sector
    for (const rs of selfReferencing) {
        // find the sector with the smallest bounds that completely contains this sector. It's a little hack but seems to
        // be good enough(tm) as far as I can tell
        let outerRS = smallestSectorContaining(rs, sectors);
        if (!outerRS) {
            console.warn('no outer sector for self-referencing sector', rs.sector.num);
            continue;
        }
        rs.zFloor = outerRS.zFloor;
        rs.zCeil = outerRS.zCeil;
        rs.floorFlat = outerRS.floorFlat;
        rs.ceilFlat = outerRS.ceilFlat;
        // TODO: things and walls use sector.light. Does that matter?
        rs.light = outerRS.light;
    }
    return sectors;
}

function smallestSectorContaining(rs: RenderSector, renderSectors: RenderSector[]) {
    let outerRS: RenderSector;
    let smallestArea = Infinity;
    let innerBounds = computeBounds(rs);
    for (const candidate of renderSectors) {
        if (candidate === rs) {
            continue;
        }

        const outerBounds = computeBounds(candidate);
        const contained = outerBounds.left <= innerBounds.left && outerBounds.right >= innerBounds.right
            && outerBounds.top <= innerBounds.top && outerBounds.bottom >= innerBounds.bottom;
        if (!contained) {
            continue;
        }

        const area = (outerBounds.right - outerBounds.left) * (outerBounds.bottom - outerBounds.top);
        if (area < smallestArea) {
            smallestArea = area;
            outerRS = candidate;
        }
    }
    return outerRS;
}

function computeBounds(rs: RenderSector) {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const subsec of rs.subsectors) {
        left = Math.min(left, subsec.bounds.left);
        right = Math.max(right, subsec.bounds.right);
        top = Math.min(top, subsec.bounds.top);
        bottom = Math.max(bottom, subsec.bounds.bottom);
    }
    return { left, right, top, bottom };
}

function createShape(verts: Vertex[]) {
    const shape = new Shape();
    shape.autoClose = true;
    shape.arcLengthDivisions = 1;
    shape.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) {
        shape.lineTo(verts[i].x, verts[i].y);
    }
    return new ShapeGeometry(shape, 1);
}