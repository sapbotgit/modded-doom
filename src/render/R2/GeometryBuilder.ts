import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import { BufferAttribute, Matrix4, PlaneGeometry, type BufferGeometry } from "three";
import type { TextureAtlas } from "./TextureAtlas";
import { HALF_PI, type LineDef, type Vertex } from "../../doom";
import type { RenderSector } from '../RenderData';

interface GeometryInfo {
    width: number;
    height: number;
    textureName: string;
    vertexOffset: number;
    type: 'flat' | 'wall';
}

// https://github.com/mrdoob/three.js/issues/17361
function flipWindingOrder(geometry: BufferGeometry) {
    const index = geometry.index.array;
    for( let i = 0, il = index.length / 3; i < il; i++ ) {

      const x = index[i * 3];
      index[i * 3] = index[i * 3 + 2];
      index[i * 3 + 2] = x;
    }
    geometry.index.needsUpdate = true;
}

export class MapRenderGeometryBuilder {
    private geos: BufferGeometry[] = [];
    private geoInfo: GeometryInfo[] = [];
    private vertexCount = 0;

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

        let skyHack = false; // TODO: fix me
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

    private wallFragment(ld: LineDef, width: number, height: number, top: number, mid: Vertex, angle: number, useLeft = false, type: 'upper' | 'lower' | 'middle' = 'middle') {
        const geo = new PlaneGeometry(width, height);
        const textureL = ld.left?.[type];
        const textureR = ld.right[type];
        const textureName = useLeft ? (textureL?.val ?? textureR.val) : (textureR.val ?? textureL?.val);

        const n = this.addGeometry(geo, textureName);
        geo.rotateX(HALF_PI);
        geo.rotateZ(angle);
        geo.translate(mid.x, mid.y, top - height * .5);
        return n;
    }

    addFlat(
        renderSector: RenderSector,
        textureName: string,
        vertical: number,
        ceiling = false,
    ) {
        let geo = renderSector.geometry.clone();
        if (ceiling) {
            // flip over triangles for ceiling
            flipWindingOrder(geo);
            // TODO: also flip normals? We're not doing lighting so maybe not important
        }
        let n = this.addGeometry(geo, textureName);
        geo.translate(0, 0, vertical);
        this.geoInfo[n].type = 'flat';
        return n;
    }

    addGeometry(geo: BufferGeometry, textureName: string) {
        this.geos.push(geo);
        geo.computeBoundingBox();
        const vertexCount = geo.attributes.position.array.length / geo.attributes.position.itemSize;
        if (textureName) {
            this.applyTexture(geo, textureName);
        } else {
            geo.setAttribute('texN', new BufferAttribute(new Float32Array(4).fill(0), 1));
        }

        this.geoInfo.push({
            textureName,
            type: 'wall',
            width: geo.boundingBox.max.x - geo.boundingBox.min.x,
            height: geo.boundingBox.max.y - geo.boundingBox.min.y,
            vertexOffset: this.vertexCount,
        });
        this.vertexCount += vertexCount;

        return this.geos.length - 1;
    }

    private applyTexture(geo: BufferGeometry, textureName: string) {
        let [index, tx] = this.textureAtlas.textureData(textureName);
        const width = geo.boundingBox.max.x - geo.boundingBox.min.x;
        const height = geo.boundingBox.max.y - geo.boundingBox.min.y;
        if (geo.type === 'PlaneGeometry') {
            geo.attributes.uv.array[0] = 0;
            geo.attributes.uv.array[1] = ((height % tx.height) - height) / tx.height;
            geo.attributes.uv.array[2] = width / tx.width;
            geo.attributes.uv.array[3] = ((height % tx.height) - height) / tx.height;
            geo.attributes.uv.array[4] = 0;
            geo.attributes.uv.array[5] = (height % tx.height) / tx.height;
            geo.attributes.uv.array[6] = width / tx.width;
            geo.attributes.uv.array[7] = (height % tx.height) / tx.height;
        } else {
            for (let i = 0; i < geo.attributes.uv.array.length; i++) {
                geo.attributes.uv.array[i] /= 64;
            }
        }

        const vertexCount = geo.attributes.position.array.length / geo.attributes.position.itemSize;
        geo.setAttribute('texN', new BufferAttribute(new Float32Array(vertexCount).fill(index), 1));
    }

    build() {
        const geometry = BufferGeometryUtils.mergeGeometries(this.geos);
        return new MapRenderGeometry(geometry, this.geoInfo, this.textureAtlas);
    }
}

class MapRenderGeometry {
    constructor(
        readonly geometry: BufferGeometry,
        readonly geoInfo: GeometryInfo[],
        readonly textureAtlas: TextureAtlas,
    ) {}

    applyTexture(geoIndex: number, textureName: string, offsetX: number, offsetY: number) {
        const geo = this.geometry;
        const info = this.geoInfo[geoIndex];
        info.textureName = textureName;
        const offset = info.vertexOffset;
        let [index, tx] = this.textureAtlas.textureData(textureName);

        // reset uv coords
        geo.attributes.uv.array[2 * offset + 0] = 0;
        geo.attributes.uv.array[2 * offset + 1] = ((info.height % tx.height) - info.height) / tx.height;
        geo.attributes.uv.array[2 * offset + 2] = info.width / tx.width;
        geo.attributes.uv.array[2 * offset + 3] = ((info.height % tx.height) - info.height) / tx.height;
        geo.attributes.uv.array[2 * offset + 4] = 0;
        geo.attributes.uv.array[2 * offset + 5] = (info.height % tx.height) / tx.height;
        geo.attributes.uv.array[2 * offset + 6] = info.width / tx.width;
        geo.attributes.uv.array[2 * offset + 7] = (info.height % tx.height) / tx.height;
        // set texture index
        geo.attributes.texN.array[offset + 0] = index;
        geo.attributes.texN.array[offset + 1] = index;
        geo.attributes.texN.array[offset + 2] = index;
        geo.attributes.texN.array[offset + 3] = index;

        geo.attributes.uv.needsUpdate = true;
        geo.attributes.texN.needsUpdate = true;
    }

    changeWallHeight(geoIndex: number, height: number) {
        const geo = this.geometry;
        const info = this.geoInfo[geoIndex];
        const offset = info.vertexOffset * 3;
        info.height = height;
        geo.attributes.position.array[offset + 1] = height + geo.attributes.position.array[offset + 7];
        geo.attributes.position.array[offset + 4] = height + geo.attributes.position.array[offset + 10];
        geo.attributes.position.needsUpdate = true;
        this.applyTexture(geoIndex, info.textureName, 0, 0);
    }
}
