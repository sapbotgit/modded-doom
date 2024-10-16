import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import { BufferAttribute, DataTexture, IntType, PlaneGeometry, type BufferGeometry, type TypedArray } from "three";
import type { TextureAtlas } from "./TextureAtlas";
import { HALF_PI, type LineDef, type Sector, type Vertex } from "../../doom";
import type { RenderSector } from '../RenderData';
import { quartIn } from 'svelte/easing';

interface GeometryInfo {
    width: number;
    height: number;
    textureName: string;
    vertexOffset: number;
    source: LineDef | RenderSector;
}

// https://github.com/mrdoob/three.js/issues/17361
function flipWindingOrder(geometry: BufferGeometry) {
    const index = geometry.index.array;
    for (let i = 0, end = index.length / 3; i < end; i++) {
      const x = index[i * 3];
      index[i * 3] = index[i * 3 + 2];
      index[i * 3 + 2] = x;
    }
    geometry.index.needsUpdate = true;


    for (let i = 0; i < geometry.attributes.normal.array.length; i++) {
        geometry.attributes.normal.array[i] *= -1;
    }
    geometry.attributes.normal.needsUpdate = true;
}

const intBufferAttribute = (array: TypedArray, itemSize: number) => {
    const attr = new BufferAttribute(array, itemSize);
    attr.gpuType = IntType;
    return attr;
}

export class MapRenderGeometryBuilder {
    private geos: BufferGeometry[] = [];
    private geoInfo: GeometryInfo[] = [];
    private vertexCount = 0;

    private skyGeo: BufferGeometry;
    private geo: BufferGeometry;

    constructor(private textureAtlas: TextureAtlas) {}

    addLinedef(ld: LineDef) {
        const mid = {
            x: (ld.v[1].x + ld.v[0].x) * 0.5,
            y: (ld.v[1].y + ld.v[0].y) * 0.5,
        };
        const vx = ld.v[1].x - ld.v[0].x;
        const vy = ld.v[1].y - ld.v[0].y;
        const width = Math.sqrt(vx * vx + vy * vy);
        const angle = Math.atan2(vy, vx);
        const leftAngle = angle + Math.PI;

        const { zFloor : zFloorL, zCeil : zCeilL } = ld.left?.sector ?? {};
        const { middle: middleL }  = ld.left ?? {};
        const { zFloor : zFloorR, zCeil : zCeilR } = ld.right.sector
        const { middle: middleR }  = ld.right;

        if (width === 0) {
            return;
        }

        // Sky Hack! https://doomwiki.org/wiki/Sky_hack
        // Detect the skyhack is simple but how it's handled is... messy. How it
        // works is:
        // (1) we set render order to 1 for everything non-sky
        // (2) put extra walls from top of line to sky with (renderOrder=0, writeColor=false, and writeDepth=true)
        //   to occlude geometry behind them
        //
        // These extra walls are mostly fine but not perfect. If you go close to an edge and look toward the bunker thing
        // you can see part of the walls occluded which shouldn't be. Interestingly you can see the same thing in gzDoom
        //
        // What I really want to do is not draw stuff that occluded but I can't think of way to do that.
        // Overall we draw way more geometry than needed.
        //
        // See also E3M6 https://doomwiki.org/wiki/File:E3m6_three.PNG
        const ceilFlatL = (ld.left?.sector ?? {}).ceilFlat?.val;
        const ceilFlatR = ld.right.sector.ceilFlat.val;
        const needSkyWall = ceilFlatR === 'F_SKY1';
        const skyHack = (ceilFlatL === 'F_SKY1' && needSkyWall);

        if (needSkyWall && !skyHack) {
            const skyHeight = ld.right.sector.skyHeight;
            this.skyWall(ld, width, skyHeight - zCeilR.val, skyHeight, mid, angle);
        }

        if (ld.left) {
            // two-sided so figure out top and bottom
            if (zCeilR.val !== zCeilL.val && !skyHack) {
                const useLeft = zCeilL.val > zCeilR.val;
                const height = useLeft ? zCeilL.val - zCeilR.val : zCeilR.val - zCeilL.val;
                const top = Math.max(zCeilR.val, zCeilL.val);
                this.wallFragment(ld, width, height, top, mid, useLeft ? leftAngle : angle, useLeft, 'upper');
            }
            if (zFloorL.val !== zFloorR.val) {
                const useLeft = zFloorR.val > zFloorL.val;
                const height = useLeft ? zFloorR.val - zFloorL.val : zFloorL.val - zFloorR.val;
                const top = Math.max(zFloorR.val, zFloorL.val);
                this.wallFragment(ld, width, height, top, mid, useLeft ? leftAngle : angle, useLeft, 'lower');
            }
            // And middle(s)
            const top = Math.min(zCeilL.val, zCeilR.val);
            const height = top - Math.max(zFloorL.val, zFloorR.val);
            if (middleL.val) {
                // TODO: doubleSidedMiddle
                this.wallFragment(ld, width, height, top, mid, leftAngle, true);
            }
            if (middleR.val) {
                // TODO: doubleSidedMiddle
                this.wallFragment(ld, width, height, top, mid, angle)
            }

        } else {
            const height = zCeilR.val - zFloorR.val;
            this.wallFragment(ld, width, height, zCeilR.val, mid, angle);
        }
    }

    private skyWall(ld: LineDef, width: number, height: number, top: number, mid: Vertex, angle: number) {
        const geo = new PlaneGeometry(width, height);
        geo.userData['skyHack'] = true;
        const vertexCount = geo.attributes.position.count;
        geo.setAttribute('texN', intBufferAttribute(new Uint16Array(vertexCount).fill(0), 1));
        geo.setAttribute('doomLight', intBufferAttribute(new Uint16Array(vertexCount).fill(0), 1));

        const n = this.addGeometry(geo, ld);
        geo.rotateX(HALF_PI);
        geo.rotateZ(angle);
        geo.translate(mid.x, mid.y, top - height * .5);

        return n;
    }

    private wallFragment(ld: LineDef, width: number, height: number, top: number, mid: Vertex, angle: number, useLeft = false, type: 'upper' | 'lower' | 'middle' = 'middle') {
        const textureL = ld.left?.[type];
        const textureR = ld.right[type];
        const textureName = useLeft ? (textureL?.val ?? textureR.val) : (textureR.val ?? textureL?.val);
        if (!textureName) {
            return -1;
        }

        const geo = new PlaneGeometry(width, height);
        const n = this.addGeometry(geo, ld);
        this.applyWallTexture(geo, textureName, useLeft ? ld.left.sector.num : ld.right.sector.num);
        geo.rotateX(HALF_PI);
        geo.rotateZ(angle);
        geo.translate(mid.x, mid.y, top - height * .5);
        this._build();
        return n;
    }

    addFlat(
        renderSector: RenderSector,
        textureName: string,
        vertical: number,
        ceiling = false,
    ) {
        let geo = renderSector.geometry.clone();
        if (textureName === 'F_SKY1') {
            // careful: userData is shared between cloned geometries
            geo.userData = { ...geo.userData };
            geo.userData['skyHack'] = true;
        }
        if (ceiling) {
            // flip over triangles for ceiling
            flipWindingOrder(geo);
        }
        let n = this.addGeometry(geo, renderSector);
        this.applyFlatTexture(geo, textureName, renderSector.sector.num);
        geo.translate(0, 0, vertical);
        this._build();
        return n;
    }

    addGeometry(geo: BufferGeometry, source: LineDef | RenderSector) {
        this.geos.push(geo);
        geo.computeBoundingBox();
        const vertexCount = geo.attributes.position.count;

        this.geoInfo.push({
            source,
            textureName: '',
            width: geo.boundingBox.max.x - geo.boundingBox.min.x,
            height: geo.boundingBox.max.y - geo.boundingBox.min.y,
            vertexOffset: this.vertexCount,
        });
        this.vertexCount += vertexCount;

        return this.geos.length - 1;
    }

    applyFlatTexture(geo: BufferGeometry, textureName: string, sectorNum: number) {
        let index = this.textureAtlas.flatTexture(textureName)[0];
        for (let i = 0; i < geo.attributes.uv.array.length; i++) {
            geo.attributes.uv.array[i] /= 64;
        }

        const vertexCount = geo.attributes.position.count;
        geo.setAttribute('texN', intBufferAttribute(new Uint16Array(vertexCount).fill(index), 1));
        geo.setAttribute('doomLight', intBufferAttribute(new Uint16Array(vertexCount).fill(sectorNum), 1));
    }

    applyWallTexture(geo: BufferGeometry, textureName: string, sectorNum: number) {
        let [index, tx] = this.textureAtlas.wallTexture(textureName);
        const width = geo.boundingBox.max.x - geo.boundingBox.min.x;
        const height = geo.boundingBox.max.y - geo.boundingBox.min.y;

        const invHeight = 1 / tx.height;
        const top = height % tx.height;
        geo.attributes.uv.array[0] = 0;
        geo.attributes.uv.array[1] = (top - height) * invHeight;
        geo.attributes.uv.array[2] = width / tx.width;
        geo.attributes.uv.array[3] = (top - height) * invHeight;
        geo.attributes.uv.array[4] = 0;
        geo.attributes.uv.array[5] = top * invHeight;
        geo.attributes.uv.array[6] = width / tx.width;
        geo.attributes.uv.array[7] = top * invHeight;

        const vertexCount = geo.attributes.position.count;
        geo.setAttribute('texN', intBufferAttribute(new Uint16Array(vertexCount).fill(index), 1));
        geo.setAttribute('doomLight', intBufferAttribute(new Uint16Array(vertexCount).fill(sectorNum), 1));
    }

    private _last: number;
    private _build(force = false) {
        clearTimeout(this._last);
        const build = () => {
            const skyGeos = this.geos.filter(e => e.userData['skyHack']);
            if (skyGeos.length === 0) {
                // BufferGeometryUtils.mergeGeometries() fails if array is empty so add a placeholder geometry
                skyGeos.push(new PlaneGeometry(0, 0));
            }
            const geos = this.geos.filter(e => !e.userData['skyHack']);
            this.geo = BufferGeometryUtils.mergeGeometries(geos);
            this.skyGeo = BufferGeometryUtils.mergeGeometries(skyGeos);
            }
            if (force) {
                build() } else {
        this._last = setTimeout(build, 20) as any;
                }
    }

    build() {
        // const skyGeos = this.geos.filter(e => e.userData['skyHack']);
        // if (skyGeos.length === 0) {
        //     // BufferGeometryUtils.mergeGeometries() fails if array is empty so add a placeholder geometry
        //     skyGeos.push(new PlaneGeometry(0, 0));
        // }
        // const geos = this.geos.filter(e => !e.userData['skyHack']);
        this._build(true);
        return new MapRenderGeometry(
            // BufferGeometryUtils.mergeGeometries(geos),
            // BufferGeometryUtils.mergeGeometries(skyGeos),
            this.geo,this.skyGeo,
            this.geoInfo, this.textureAtlas);
    }
}

export class MapRenderGeometry {
    readonly lightMap: DataTexture;
    private lightCache = new Map<number, number>;

    constructor(
        readonly geometry: BufferGeometry,
        readonly skyGeometry: BufferGeometry,
        readonly geoInfo: GeometryInfo[],
        readonly textureAtlas: TextureAtlas,
    ) {
        const maxLight = 255;
        for (let i = 0; i < maxLight + 1; i++) {
            // scale light using a curve to make it look more like doom
            // TODO: in the old render, I used sineIn but here I need something "stronger". Why?
            const light = Math.floor(quartIn(i / maxLight) * maxLight);
            this.lightCache.set(i, light);
        }

        let sectors = new Set<Sector>();
        geoInfo.forEach(info => {
            if ('sector' in info.source) {
                sectors.add(info.source.sector);
            }
        });

        const textureSize = findNearestPower2(Math.sqrt(sectors.size));
        const buff = new Uint8ClampedArray(textureSize * textureSize * 4);
        this.lightMap = new DataTexture(buff, textureSize, textureSize);
        sectors.keys().forEach((sector, i) => {
            sector.light.subscribe(light => {
                const lightVal = this.lightCache.get(Math.max(0, Math.min(255, Math.floor(light))));
                buff[i * 4 + 0] = lightVal;
                buff[i * 4 + 1] = lightVal;
                buff[i * 4 + 2] = lightVal;
                buff[i * 4 + 3] = 255;
                this.lightMap.needsUpdate = true;
            });
        });
    }

    applyTexture(geoIndex: number, textureName: string, offsetX: number, offsetY: number) {
        const geo = this.geometry;
        const info = this.geoInfo[geoIndex];
        info.textureName = textureName;
        const offset = info.vertexOffset;
        let [index, tx] = this.textureAtlas.wallTexture(textureName);

        // reset uv coords
        const invHeight = 1 / tx.height;
        geo.attributes.uv.array[2 * offset + 0] = 0;
        geo.attributes.uv.array[2 * offset + 1] = ((info.height % tx.height) - info.height) * invHeight;
        geo.attributes.uv.array[2 * offset + 2] = info.width / tx.width;
        geo.attributes.uv.array[2 * offset + 3] = ((info.height % tx.height) - info.height) * invHeight;
        geo.attributes.uv.array[2 * offset + 4] = 0;
        geo.attributes.uv.array[2 * offset + 5] = (info.height % tx.height) * invHeight;
        geo.attributes.uv.array[2 * offset + 6] = info.width / tx.width;
        geo.attributes.uv.array[2 * offset + 7] = (info.height % tx.height) * invHeight;
        // set texture index
        if ('sector' in info.source) {
            geo.attributes.texN.array[offset + 0] = index;
            geo.attributes.texN.array[offset + 1] = index;
            geo.attributes.texN.array[offset + 2] = index;
            geo.attributes.texN.array[offset + 3] = index;
        }

        geo.attributes.uv.needsUpdate = true;
        geo.attributes.texN.needsUpdate = true;
    }

    changeWallHeight(geoIndex: number, height: number, tname: string) {
        const geo = this.geometry;
        const info = this.geoInfo[geoIndex];
        const offset = info.vertexOffset * 3;
        info.height = height;
        geo.attributes.position.array[offset + 1] = height + geo.attributes.position.array[offset + 7];
        geo.attributes.position.array[offset + 4] = height + geo.attributes.position.array[offset + 10];
        geo.attributes.position.needsUpdate = true;
        this.applyTexture(geoIndex, tname, 0, 0);
    }
}

function findNearestPower2(n: number) {
    let t = 1;
    while (t < n) {
        t *= 2;
    }
    return t;
}
