import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import { BufferAttribute, IntType, PlaneGeometry, type BufferGeometry } from "three";
import type { MapTextureAtlas } from "./TextureAtlas";
import { HALF_PI, type LineDef, type SideDef, type Vertex } from "../../doom";
import type { RenderSector } from '../RenderData';
import { inspectorAttributeName } from './MapMeshMaterial';

// https://github.com/mrdoob/three.js/issues/17361
function flipWindingOrder(geometry: BufferGeometry) {
    const index = geometry.index.array;
    for (let i = 0, end = index.length / 3; i < end; i++) {
      const x = index[i * 3];
      index[i * 3] = index[i * 3 + 2];
      index[i * 3 + 2] = x;
    }
    geometry.index.needsUpdate = true;

    // flip normals (for lighting)
    for (let i = 0; i < geometry.attributes.normal.array.length; i++) {
        geometry.attributes.normal.array[i] *= -1;
    }
    geometry.attributes.normal.needsUpdate = true;
}

const sInt16BufferFrom = (items: number[], vertexCount: number) => {
    const array = new Int16Array(items.length * vertexCount);
    for (let i = 0; i < vertexCount * items.length; i += items.length) {
        for (let j = 0; j < items.length; j++) {
            array[i + j] = items[j];
        }
    }
    const attr = new BufferAttribute(array, items.length);
    attr.gpuType = IntType;
    return attr;
}
export const int16BufferFrom = (items: number[], vertexCount: number) => {
    const array = new Uint16Array(items.length * vertexCount);
    for (let i = 0; i < vertexCount * items.length; i += items.length) {
        for (let j = 0; j < items.length; j++) {
            array[i + j] = items[j];
        }
    }
    const attr = new BufferAttribute(array, items.length);
    attr.gpuType = IntType;
    return attr;
}

type GeoInfo = { vertexOffset: number, vertexCount: number, sky: boolean };
export function geometryBuilder() {
    let geos: BufferGeometry[] = [];
    let geoInfo: GeoInfo[] = [];
    let numVertex = 0;
    let skyVertex = 0;

    const createWallGeo = (width: number, height: number, mid: Vertex, top: number, angle: number) => {
        const geo = new PlaneGeometry(width, height);
        geo.rotateX(HALF_PI);
        geo.rotateZ(angle);
        geo.translate(mid.x, mid.y, top - height * .5);
        return geo;
    }

    const addWallGeometry = (geo: BufferGeometry, sectorNum: number) => {
        const sky = geo.userData['sky'];
        const vertexCount = geo.attributes.position.count;
        const vertexOffset = sky ? skyVertex : numVertex;
        if (sky) {
            skyVertex += vertexCount;
        } else {
            numVertex += vertexCount;
        }

        geo.setAttribute('texN', int16BufferFrom([0], vertexCount));
        geo.setAttribute('doomLight', int16BufferFrom([sectorNum], vertexCount));
        geo.setAttribute('doomOffset', sInt16BufferFrom([0, 0], vertexCount));
        geos.push(geo);
        geoInfo.push({ vertexCount, vertexOffset, sky });
        return geoInfo.length - 1;
    };

    const addFlatGeometry = (geo: BufferGeometry, sectorNum: number): number => {
        const sky = geo.userData['sky'];
        const vertexCount = geo.attributes.position.count;
        const vertexOffset = sky ? skyVertex : numVertex;
        if (sky) {
            skyVertex += vertexCount;
        } else {
            numVertex += vertexCount;
        }

        for (let i = 0; i < geo.attributes.uv.array.length; i++) {
            geo.attributes.uv.array[i] /= 64;
        }
        geo.setAttribute('texN', int16BufferFrom([0], vertexCount));
        geo.setAttribute('doomLight', int16BufferFrom([sectorNum], vertexCount));
        geo.setAttribute('doomOffset', sInt16BufferFrom([0, 0], vertexCount));
        geos.push(geo);
        geoInfo.push({ vertexCount, vertexOffset, sky });
        return geoInfo.length - 1;
    };

    const createFlatGeo = (geo: BufferGeometry, textureName: string) => {
        const geometry = geo.clone();
        // CAUTION: geometry.clone() re-uses userData so we do a copy but it's not a deep copy
        geometry.userData = { ...geometry.userData };
        geometry.userData['sky'] = textureName === 'F_SKY1';
        return geometry;
    }

    const emptyPlane = new PlaneGeometry(0, 0);
    emptyPlane.setAttribute('texN', int16BufferFrom([0], 1));
    emptyPlane.setAttribute('doomLight', int16BufferFrom([0], 0));
    emptyPlane.setAttribute('doomOffset', sInt16BufferFrom([0, 0], 0));
    const mergeGeos = (name: string, geos: BufferGeometry[]) => {
        if (!geos.length) {
            // BufferGeometryUtils.mergeGeometries() fails if array is empty so add a placeholder geometry
            geos.push(emptyPlane);
        }
        const geo = BufferGeometryUtils.mergeGeometries(geos);
        geo.name = name;
        return geo;
    }

    function build() {
        const skyGeometry = mergeGeos('sky', geos.filter(e => e.userData['sky']));
        const geometry = mergeGeos('map', geos.filter(e => !e.userData['sky']));
        return { geometry, skyGeometry, geoInfo };
    }

    return { createWallGeo, addWallGeometry, addFlatGeometry, createFlatGeo, build };
}

type MapGeometryUpdater = ReturnType<typeof mapGeometry>;
type MapUpdater = (m: MapGeometryUpdater) => void;
interface LindefUpdater{
    lower: MapUpdater;
    upper:  MapUpdater;
    midLeft: MapUpdater;
    midRight: MapUpdater;
    single: MapUpdater;
}

function mapGeometryBuilder(textures: MapTextureAtlas) {
    const geoBuilder = geometryBuilder();

    type TextureType = 'upper' | 'lower' | 'middle';
    const chooseTexture = (ld: LineDef, type: TextureType, useLeft = false) => {
        let textureL = ld.left?.[type];
        let textureR = ld.right[type];
        let texture = useLeft ? (textureL?.val ?? textureR.val) : (textureR.val ?? textureL?.val);
        return texture;
    }

    const addLinedef = (ld: LineDef): LindefUpdater => {
        const vx = ld.v[1].x - ld.v[0].x;
        const vy = ld.v[1].y - ld.v[0].y;
        const width = Math.sqrt(vx * vx + vy * vy);
        const result: LindefUpdater = {
            lower: null,
            upper: null,
            midLeft: null,
            midRight: null,
            single: null,
        };
        if (width === 0) {
            return result;
        }

        const inspectVal = [0, ld.num];
        const mid = {
            x: (ld.v[1].x + ld.v[0].x) * 0.5,
            y: (ld.v[1].y + ld.v[0].y) * 0.5,
        };
        const angle = Math.atan2(vy, vx);

        const { zFloor : zFloorL, zCeil : zCeilL } = ld.left?.sector ?? {};
        const { middle: middleL }  = ld.left ?? {};
        const { zFloor : zFloorR, zCeil : zCeilR } = ld.right.sector
        const { middle: middleR }  = ld.right;

        // these values don't matter because they get reset by the linedef updaters before being rendered
        const top = 1;
        const height = 1;

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
        const skyHeight = ld.right.sector.skyHeight;

        function applySpecials(geo: BufferGeometry) {
            if (ld.special === 48) {
                for (let i = 0; i < geo.attributes.position.count; i++) {
                    geo.attributes.doomOffset.array[i * 2] = 1;
                }
            } else if (ld.special === 85) {
                for (let i = 0; i < geo.attributes.position.count; i++) {
                    geo.attributes.doomOffset.array[i * 2] = -1;
                }
            }
            if (ld.special === 255) {
                for (let i = 0; i < geo.attributes.position.count; i++) {
                    geo.attributes.doomOffset.array[i * 2] = ld.right.xOffset.initial;
                    geo.attributes.doomOffset.array[i * 2 + 1] = ld.right.yOffset.initial;
                }
            }
        }

        // texture alignment is complex https://doomwiki.org/wiki/Texture_alignment
        function pegging(type: TextureType, height: number) {
            let offset = 0;
            if (ld.left) {
                if (type === 'lower' && (ld.flags & 0x0010)) {
                    // unpegged so subtract higher floor from ceiling to get real offset
                    // NOTE: we use skyheight (if available) instead of zCeil because of the blue wall switch in E3M6.
                    offset = (skyHeight ?? zCeilR.val) - Math.max(zFloorL.val, zFloorR.val);
                } else if (type === 'upper' && !(ld.flags & 0x0008)) {
                    offset = -height;
                } else if (type === 'middle' && (ld.flags & 0x0010)) {
                    offset = -height;
                }
            } else if (ld.flags & 0x0010) {
                // peg to floor (bottom left)
                offset = -height;
            }
            return offset;
        }

        if (needSkyWall && !skyHack) {
            const geo = geoBuilder.createWallGeo(width, skyHeight - zCeilR.val, mid, skyHeight, angle);
            geo.userData['sky'] = true;
            geo.setAttribute(inspectorAttributeName, int16BufferFrom(inspectVal, geo.attributes.position.count));
            geoBuilder.addWallGeometry(geo, ld.right.sector.num);
        }

        if (ld.left) {
            // two-sided so figure out top
            if (!skyHack) {
                let left = false;
                const geo = geoBuilder.createWallGeo(width, height, mid, top, angle);
                const idx = geoBuilder.addWallGeometry(geo, ld.right.sector.num);
                geo.setAttribute(inspectorAttributeName, int16BufferFrom(inspectVal, geo.attributes.position.count));
                applySpecials(geo);

                result.upper = m => {
                    let useLeft = zCeilL.val >= zCeilR.val;
                    const height = useLeft ? zCeilL.val - zCeilR.val : zCeilR.val - zCeilL.val;
                    const top = Math.max(zCeilR.val, zCeilL.val);
                    const side = useLeft ? ld.left : ld.right;
                    m.changeWallHeight(idx, top, height);
                    m.applyWallTexture(idx, chooseTexture(ld, 'upper', useLeft),
                        width, height,
                        side.xOffset.initial, side.yOffset.initial + pegging('upper', height));
                    if (left !== useLeft) {
                        m.flipWallFace(idx, side.sector.num);
                        left = useLeft;
                    }
                };
            }
            // And bottom
            if (true) {
                let left = false;
                const geo = geoBuilder.createWallGeo(width, height, mid, top, angle);
                const idx = geoBuilder.addWallGeometry(geo, ld.right.sector.num);
                geo.setAttribute(inspectorAttributeName, int16BufferFrom(inspectVal, geo.attributes.position.count));
                applySpecials(geo);

                result.lower = m => {
                    // NB: use >= here, see lowering wall at the start of E1M8. If we only use > then there is a
                    // slight flicker when switching from right side to left side
                    let useLeft = zFloorR.val >= zFloorL.val;
                    const height = left ? zFloorR.val - zFloorL.val : zFloorL.val - zFloorR.val;
                    // FIXME: LD#40780 in Sunder MAP20 has zfighting. I think it's from big negative yoffset which pushes
                    // the middle wall down and perhaps it should push the top of this wall down too. I'm not sure.
                    // The sector floors also have problems in that area so something isn't right. (special 242)
                    const side = useLeft ? ld.left : ld.right;
                    const top = Math.max(zFloorR.val, zFloorL.val);
                    m.changeWallHeight(idx, top, height);
                    m.applyWallTexture(idx, chooseTexture(ld, 'lower', useLeft),
                        width, height,
                        side.xOffset.initial, side.yOffset.initial + pegging('lower', height));
                    if (left !== useLeft) {
                        m.flipWallFace(idx, side.sector.num);
                        left = useLeft;
                    }
                };
            }

            // And middle(s)
            const middleUpdater = (idx: number, side: SideDef) => (m: MapGeometryUpdater) => {
                const tx = chooseTexture(ld, 'middle', side === ld.left);
                const pic = textures.wallTexture(tx)[1];
                const zFloor = Math.max(zFloorL.val, zFloorR.val);
                const zCeil = Math.min(zCeilL.val, zCeilR.val);
                // double sided linedefs (generally for semi-transparent textures like gates/fences) do not repeat vertically
                // and lower unpegged sticks to the ground
                let top = ((ld.flags & 0x0010) ? Math.min(zFloor + pic.height, zCeil) : zCeil) + side.yOffset.val;
                // don't repeat so clip by height or floor/ceiling gap
                let height = Math.min(pic.height, zCeil - zFloor + side.yOffset.val);
                m.changeWallHeight(idx, top, height);
                m.applyWallTexture(idx, tx, width, height,
                    side.xOffset.initial, pegging('middle', height));
            };
            if (middleL.val) {
                const geo = geoBuilder.createWallGeo(width, height, mid, top, angle + Math.PI);
                const idx = geoBuilder.addWallGeometry(geo, ld.left.sector.num);
                geo.setAttribute(inspectorAttributeName, int16BufferFrom(inspectVal, geo.attributes.position.count));
                applySpecials(geo);

                result.midLeft = middleUpdater(idx, ld.left);
            }
            if (middleR.val) {
                const geo = geoBuilder.createWallGeo(width, height, mid, top, angle);
                const idx = geoBuilder.addWallGeometry(geo, ld.right.sector.num);
                geo.setAttribute(inspectorAttributeName, int16BufferFrom(inspectVal, geo.attributes.position.count));
                applySpecials(geo);

                result.midRight = middleUpdater(idx, ld.right);
            }

        } else {
            const geo = geoBuilder.createWallGeo(width, height, mid, top, angle);
            const idx = geoBuilder.addWallGeometry(geo, ld.right.sector.num);
            geo.setAttribute(inspectorAttributeName, int16BufferFrom(inspectVal, geo.attributes.position.count));
            applySpecials(geo);

            result.single = m => {
                const height = zCeilR.val - zFloorR.val;
                m.changeWallHeight(idx, zCeilR.val, height);
                m.applyWallTexture(idx, chooseTexture(ld, 'middle'),
                    width, height,
                    ld.right.xOffset.initial, ld.right.yOffset.initial + pegging('middle', height));
            };
        }
        return result;
    }

    const addSector = (rs: RenderSector): [number, number, number[]] => {
        const inspectVal = [1, rs.sector.num];

        // TODO: what about hack floor/ceiling? That whole thing is buggy and needs a rewrite anyway
        const floorGeo = geoBuilder.createFlatGeo(rs.geometry, rs.sector.floorFlat.val);
        floorGeo.setAttribute(inspectorAttributeName, int16BufferFrom(inspectVal, floorGeo.attributes.position.count));
        const floor = geoBuilder.addFlatGeometry(floorGeo, rs.sector.num);

        const ceilGeo = geoBuilder.createFlatGeo(rs.geometry, rs.sector.ceilFlat.val);
        ceilGeo.setAttribute(inspectorAttributeName, int16BufferFrom(inspectVal, ceilGeo.attributes.position.count));
        // flip over triangles for ceiling
        flipWindingOrder(ceilGeo);
        const ceil = geoBuilder.addFlatGeometry(ceilGeo, rs.sector.num);

        let extras = [];
        for (const extra of rs.extraFlats) {
            const geo = geoBuilder.createFlatGeo(extra.geometry, extra.flat.val);
            if (extra.ceil) {
                flipWindingOrder(geo);
            }
            geo.setAttribute(inspectorAttributeName, int16BufferFrom(inspectVal, geo.attributes.position.count));
            extras.push(geoBuilder.addFlatGeometry(geo, extra.lightSector.num));
        }
        return [ceil, floor, extras];
    }

    function build() {
        const { skyGeometry, geometry, geoInfo } = geoBuilder.build();
        return mapGeometry(textures, geometry, skyGeometry, geoInfo);
    }

    return { addSector, addLinedef, build };
}

export function buildMapGeometry(textureAtlas: MapTextureAtlas, renderSectors: RenderSector[]) {
    // Geometry updates happen on the merged geometry but it's more efficient to merge the geometries
    // once. With this little structure, we keep track of all the pending changes to apply them when
    // the geometry has been created.
    let pendingUpdates: MapUpdater[] = [];
    let mapGeo: MapGeometryUpdater = (() => {
        return {
            geometry: undefined,
            skyGeometry: undefined,
            moveFlat: (idx, z) => pendingUpdates.push(m => m.moveFlat(idx, z)),
            applyFlatTexture: (idx, tx) => pendingUpdates.push(m => m.applyFlatTexture(idx, tx)),
            applyWallTexture: (idx, tx, w, h, ox, oy) => pendingUpdates.push(m => m.applyWallTexture(idx, tx, w, h, ox, oy)),
            changeWallHeight: (idx, top, height) => pendingUpdates.push(m => m.changeWallHeight(idx, top, height)),
            flipWallFace: (idx, n) => pendingUpdates.push(m => m.flipWallFace(idx, n)),
        };
    })();

    const mapBuilder = mapGeometryBuilder(textureAtlas);

    // We're going to subscribe to a whole bunch of property change events so we better keep track of
    // the unsubscribes so we don't leak memory in HMR situation (or when reloading a map)
    let disposables: (() => void)[] = [];
    let linedefUpdaters = new Map<number, LindefUpdater>();
    for (const rs of renderSectors) {
        rs.linedefs.map(ld => {
            const updaters = mapBuilder.addLinedef(ld);
            linedefUpdaters.set(ld.num, updaters);

            if (ld.left) {
                if (updaters.lower) {
                    disposables.push(ld.left.lower.subscribe(() => updaters.lower(mapGeo)));
                }
                if (updaters.upper) {
                    disposables.push(ld.left.upper.subscribe(() => updaters.upper(mapGeo)));
                }
                if (updaters.midLeft) {
                    disposables.push(ld.left.middle.subscribe(() => updaters.midLeft(mapGeo)));
                }
            }
            if (updaters.lower) {
                disposables.push(ld.right.lower.subscribe(() => updaters.lower(mapGeo)));
            }
            if (updaters.upper) {
                disposables.push(ld.right.upper.subscribe(() => updaters.upper(mapGeo)));
            }
            disposables.push(ld.right.middle.subscribe(() =>{
                updaters.midRight?.(mapGeo);
                updaters.single?.(mapGeo);
            }));
        });
        if (!rs.geometry) {
            // Plutonia MAP29?
            continue;
        }

        let [ceil, floor, extras] = mapBuilder.addSector(rs);

        // subscribe for changes and update map geometry
        // update sector z
        disposables.push(rs.sector.zFloor.subscribe(z => mapGeo.moveFlat(floor, z)));
        disposables.push(rs.sector.zCeil.subscribe(z => mapGeo.moveFlat(ceil, rs.sector.skyHeight ?? z)));
        // update sector textures
        disposables.push(rs.sector.ceilFlat.subscribe(name => mapGeo.applyFlatTexture(ceil, name)));
        disposables.push(rs.sector.floorFlat.subscribe(name => mapGeo.applyFlatTexture(floor, name)));

        for (let i = 0; i < extras.length; i++) {
            let extra = rs.extraFlats[i];
            let idx = extras[i];
            // add a tiny offset to z to make sure extra flat is rendered below (floor) or above) ceil) the actual
            // flat to avoid z-fighting. We can use a small offset because doom z values are integers except when the
            // platform is moving but we can tolerate a small error for moving platforms.
            let zOffset = extra.ceil ? 0.0001 : -0.0001;
            disposables.push(extra.z.subscribe(z => mapGeo.moveFlat(idx, z + zOffset)));
            disposables.push(extra.flat.subscribe(name => mapGeo.applyFlatTexture(idx, name)));
        }
    }

    // try to minimize subscriptions by grouping lindefs that listen to a sector change
    // and only subscribing to that sector once. I'm not sure it's worth it. Actually, I'm
    // not sure using svelte store makes sense anymore at all and I'll probably remove it
    // which should make this all simpler (I hope)
    for (const rs of renderSectors) {
        const updaters = [...new Set([
            ...rs.sector.portalSegs?.map(seg => seg.linedef) ?? [],
            ...rs.linedefs.map(ld => ld)
        ])];

        const lowers = updaters.map(e => linedefUpdaters.get(e.num)?.lower).filter(e => e);
        const uppers = updaters.map(e => linedefUpdaters.get(e.num)?.upper).filter(e => e);
        const midLefts = updaters.map(e => linedefUpdaters.get(e.num)?.midLeft).filter(e => e);
        const midRights = updaters.map(e => linedefUpdaters.get(e.num)?.midRight).filter(e => e);
        const singles = updaters.map(e => linedefUpdaters.get(e.num)?.single).filter(e => e);

        disposables.push(rs.sector.zFloor.subscribe(() => {
            lowers.forEach(fn => fn(mapGeo));
            uppers.forEach(fn => fn(mapGeo));
            midLefts.forEach(fn => fn(mapGeo));
            midRights.forEach(fn => fn(mapGeo));
            singles.forEach(fn => fn(mapGeo));
        }));
        disposables.push(rs.sector.zCeil.subscribe(() => {
            lowers.forEach(fn => fn(mapGeo));
            uppers.forEach(fn => fn(mapGeo));
            midLefts.forEach(fn => fn(mapGeo));
            midRights.forEach(fn => fn(mapGeo));
            singles.forEach(fn => fn(mapGeo));
        }));
    }

    mapGeo = mapBuilder.build();
    pendingUpdates.forEach(fn => fn(mapGeo));
    textureAtlas.commit();

    const { geometry, skyGeometry } = mapGeo;
    const dispose = () => disposables.forEach(fn => fn());
    return { geometry, skyGeometry, dispose };
}

export function mapGeometry(
    textures: MapTextureAtlas,
    geometry: BufferGeometry,
    skyGeometry: BufferGeometry,
    geoInfo: GeoInfo[],
) {
    const applyWallTexture = (geoIndex: number, textureName: string, width: number, height: number, offsetX: number, offsetY: number) => {
        if (geoInfo[geoIndex].sky) {
            return;
        }
        if (!textureName) {
            changeWallHeight(geoIndex, 0, 0);
            return;
        }

        const [index, tx] = textures.wallTexture(textureName);
        const vertexOffset = geoInfo[geoIndex].vertexOffset;
        const geo = geoInfo[geoIndex].sky ? skyGeometry : geometry;

        // You know... I wonder if we could push even more of this into the fragment shader? We could put xOffset/yOffset
        // and maybe even pegging offset too. The drawback there is that mostly these values don't change (except xOffset/yOffset
        // for animated textures) so maybe it's not the right place?
        const invHeight = 1 / tx.height;
        const invWidth = 1 / tx.width;
        geo.attributes.uv.array[2 * vertexOffset + 0] =
            geo.attributes.uv.array[2 * vertexOffset + 4] = offsetX * invWidth;
        geo.attributes.uv.array[2 * vertexOffset + 1] =
            geo.attributes.uv.array[2 * vertexOffset + 3] = ((height % tx.height) - height + offsetY) * invHeight;
        geo.attributes.uv.array[2 * vertexOffset + 5] =
            geo.attributes.uv.array[2 * vertexOffset + 7] = ((height % tx.height) + offsetY) * invHeight;
        geo.attributes.uv.array[2 * vertexOffset + 2] =
            geo.attributes.uv.array[2 * vertexOffset + 6] = (width + offsetX) * invWidth;
        // set texture index
        geo.attributes.texN.array[vertexOffset + 0] = index;
        geo.attributes.texN.array[vertexOffset + 1] = index;
        geo.attributes.texN.array[vertexOffset + 2] = index;
        geo.attributes.texN.array[vertexOffset + 3] = index;

        geo.attributes.texN.needsUpdate = true;
        geo.attributes.uv.needsUpdate = true;
    };

    const changeWallHeight = (geoIndex: number, top: number, height: number) => {
        const offset = geoInfo[geoIndex].vertexOffset * 3;
        const geo = geoInfo[geoIndex].sky ? skyGeometry : geometry;
        geo.attributes.position.array[offset + 2] = top;
        geo.attributes.position.array[offset + 5] = top;
        geo.attributes.position.array[offset + 8] = top - height;
        geo.attributes.position.array[offset + 11] = top - height;
        geo.attributes.position.needsUpdate = true;
    };

    const flipWallFace = (geoIndex: number, sectorNum: number) => {
        const offset = geoInfo[geoIndex].vertexOffset * 3;
        const geo = geoInfo[geoIndex].sky ? skyGeometry : geometry;

        // apply new sector light
        for (let i = geoInfo[geoIndex].vertexOffset, end = geoInfo[geoIndex].vertexOffset + geoInfo[geoIndex].vertexCount; i < end; i++) {
            geo.attributes.doomLight.array[i] = sectorNum;
        }
        geo.attributes.doomLight.needsUpdate = true;

        // rotate wall by 180
        let x1 = geo.attributes.position.array[offset + 0];
        let y1 = geo.attributes.position.array[offset + 1];
        geo.attributes.position.array[offset + 0] = geo.attributes.position.array[offset + 9];
        geo.attributes.position.array[offset + 1] = geo.attributes.position.array[offset + 10];
        geo.attributes.position.array[offset + 9] = x1;
        geo.attributes.position.array[offset + 10] = y1;

        let x2 = geo.attributes.position.array[offset + 3];
        let y2 = geo.attributes.position.array[offset + 4];
        geo.attributes.position.array[offset + 3] = geo.attributes.position.array[offset + 6];
        geo.attributes.position.array[offset + 4] = geo.attributes.position.array[offset + 7];
        geo.attributes.position.array[offset + 6] = x2;
        geo.attributes.position.array[offset + 7] = y2;

        geo.attributes.position.needsUpdate = true;

        // flip normals so lighting works
        for (let i = geoInfo[geoIndex].vertexOffset * 3, end = (geoInfo[geoIndex].vertexOffset + geoInfo[geoIndex].vertexCount) * 3; i < end; i++) {
            geo.attributes.normal.array[i] *= -1;
        }
        geo.attributes.normal.needsUpdate = true;
    };

    const applyFlatTexture = (geoIndex: number, textureName: string) => {
        if (geoInfo[geoIndex].sky) {
            return;
        }
        let index = textures.flatTexture(textureName)[0];
        const vertexCount = geoInfo[geoIndex].vertexCount;
        const vertexOffset = geoInfo[geoIndex].vertexOffset;
        geometry.attributes.texN.array.fill(index, vertexOffset, vertexOffset + vertexCount);
        geometry.attributes.texN.needsUpdate = true;
    };

    const moveFlat = (geoIndex: number, zPosition: number) => {
        const geo = geoInfo[geoIndex].sky ? skyGeometry : geometry;
        const vertexCount = geoInfo[geoIndex].vertexCount;
        const vertexOffset = geoInfo[geoIndex].vertexOffset;
        let end = (vertexCount + vertexOffset) * 3;
        for (let i = vertexOffset * 3; i < end; i += 3) {
            geo.attributes.position.array[i + 2] = zPosition;
        }
        geo.attributes.position.needsUpdate = true;
    };

    return {
        geometry,
        skyGeometry,
        moveFlat,
        applyFlatTexture,
        applyWallTexture,
        changeWallHeight,
        flipWallFace,
    }
}
