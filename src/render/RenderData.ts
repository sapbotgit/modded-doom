import { BufferGeometry, ClampToEdgeWrapping, Color, DataTexture, LinearFilter, NearestFilter, RepeatWrapping, SRGBColorSpace, Shape, ShapeGeometry, type NormalBufferAttributes, type Texture } from "three";
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import {
    type DoomWad,
    type Seg,
    type SubSector,
    type Sector,
    MapData,
    type Vertex,
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
    geometry: BufferGeometry<NormalBufferAttributes>;
    // TODO: MapObjects so we only render them if the sector is visible?
}

export function buildRenderSectors(map: MapData) {
    let sectors: RenderSector[] = [];
    const allSubsectors = map.nodes.map(e => [e.childLeft, e.childRight]).flat().filter(e => 'segs' in e) as SubSector[];
    const allSegs = allSubsectors.map(e => e.segs).flat();
    for (const sector of map.sectors) {
        const subsectors = allSubsectors.filter(e => e.sector === sector);
        const portalSegs = allSegs.filter(e => e.direction === 0 && e.linedef.left?.sector === sector);
        const geos = subsectors.map(e => createShape(e.vertexes))
        // E3M2 (maybe other maps) have sectors with no subsectors and therefore no vertexes. Odd.
        const geometry = geos.length ? BufferGeometryUtils.mergeGeometries(geos) : null;
        sectors.push({ sector, subsectors, portalSegs, geometry });
    }
    return sectors;
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