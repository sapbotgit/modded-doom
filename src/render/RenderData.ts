import { BufferGeometry, ClampToEdgeWrapping, Color, DataTexture, NearestFilter, RepeatWrapping, SRGBColorSpace, Shape, ShapeGeometry, type Texture } from "three";
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import {
    type DoomWad,
    type SubSector,
    type Sector,
    type Vertex,
    type LineDef,
    pointOnLine,
    type Store,
    type MapObject,
    type MapRuntime,
    store,
    MFFlags,
} from "../doom";
import { sineIn } from 'svelte/easing';
import { derived, readable, type Readable } from "svelte/store";

// all flats (floors/ceilings) are 64px
const flatRepeat = 1 / 64;

export const namedColor = (n: number) => Object.values(Color.NAMES)[n % Object.keys(Color.NAMES).length];

export class MapTextures {
    private cache = new Map<string, Texture>();
    private lightCache = new Map<number, Color>;

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
    visible: Store<boolean>;
    sector: Sector;
    subsectors: SubSector[];
    linedefs: LineDef[];
    geometry: BufferGeometry;
    zHackFloor: Readable<number>;
    zHackCeil: Readable<number>;
    flatLighting: Store<number>;
    mobjs: Store<Set<MapObject>>;
}

export function buildRenderSectors(wad: DoomWad, mapRuntime: MapRuntime) {
    console.time('b-rs')
    // WOW! There are so many nifty rendering (and gameplay) tricks out there:
    // https://www.doomworld.com/forum/topic/52921-thread-of-vanilla-mapping-tricks/
    // https://www.doomworld.com/vb/thread/74354
    // https://www.doomworld.com/vb/thread/103009
    // https://www.doomworld.com/tutorials/regintro.php
    // Not sure how many I actually want to implement...
    const map = mapRuntime.data;

    // these maps that sort data by sector make an order of magnitude difference for large maps,
    // like sunder or map05 of cosmogensis. On my machine, time drops from 5-8s to 300-400ms.
    const subsectMap = new Map<Sector, SubSector[]>();
    map.nodes.forEach(node => {
        if ('segs' in node.childLeft) {
            const list = subsectMap.get(node.childLeft.sector) ?? [];
            list.push(node.childLeft);
            subsectMap.set(node.childLeft.sector, list);
        }
        if ('segs' in node.childRight) {
            const list = subsectMap.get(node.childRight.sector) ?? [];
            list.push(node.childRight);
            subsectMap.set(node.childRight.sector, list);
        }
    });
    const sectorRightLindefs = new Map<Sector, LineDef[]>();
    const sectorLeftLindefs = new Map<Sector, LineDef[]>();
    map.linedefs.filter(ld => {
        const right = sectorRightLindefs.get(ld.right.sector) ?? [];
        right.push(ld);
        sectorRightLindefs.set(ld.right.sector, right);

        if (ld.left) {
            const left = sectorLeftLindefs.get(ld.left.sector) ?? [];
            left.push(ld);
            sectorLeftLindefs.set(ld.left.sector, left);
        }
    });

    let selfReferencing: RenderSector[] = [];
    let secMap = new Map<Sector, RenderSector>();
    let rSectors: RenderSector[] = [];
    for (const sector of map.sectors) {
        const subsectors = subsectMap.get(sector) ?? [];
        const geos = subsectors.map(subsec => createShape(subsec.vertexes)).filter(e => e);
        const linedefs = sectorRightLindefs.get(sector) ?? [];
        // E3M2 (maybe other maps) have sectors with no subsectors and therefore no vertexes. Odd.
        const geometry = geos.length ? BufferGeometryUtils.mergeGeometries(geos) : null;
        if (geometry) {
            geometry.computeBoundingBox();
            sector.zFloor.subscribe(floor => geometry.boundingBox.min.z = floor);
            sector.zCeil.subscribe(ceil => geometry.boundingBox.max.z = ceil);
        }
        const zHackCeil = readable(0);
        const zHackFloor = readable(0);
        const flatLighting = sector.light;
        const visible = store(true)
        const mobjs = store(new Set<MapObject>());
        const renderSector: RenderSector = { visible, sector, subsectors, geometry, linedefs, zHackFloor, zHackCeil, flatLighting, mobjs };
        rSectors.push(renderSector);
        secMap.set(renderSector.sector, renderSector);

        // fascinating little render hack: self-referencing sector. Basically a sector where all lines are two-sided
        // and both sides refer to the same sector. For doom, that sector would be invisible but the renderer fills in the
        // floor and ceiling gaps magically. We can see the effect in Plutonia MAP02 (invisible bridge), MAP24 (floating cages),
        // MAP28 (brown sewage) and TNT MAP02 where the backpack is in "deep water".
        // https://doomwiki.org/wiki/Making_a_self-referencing_sector
        // https://doomwiki.org/wiki/Making_deep_water
        const leftlines = sectorLeftLindefs.get(sector) ?? [];
        const selfref = leftlines.length === linedefs.length && leftlines.every(ld => ld.right.sector === sector);
        if (selfref && geometry) {
            selfReferencing.push(renderSector);
        }

        // floor hack (TNT MAP18): if only left lines face this sector and have no lower texture (and floor is not equal)
        // then we want to draw the floor at the height of the outer sector (like deep water). We can see this in the room
        // where revenants are in the floor or the cyberdemon room with the brown sludge below the floating marble slabs
        const floorHack =
            leftlines.length > 0 && linedefs.length === 0
            && leftlines[0].right.sector.zFloor.val !== sector.zFloor.val
            && leftlines.every(ld => !ld.right.lower.val && !ld.left.lower.val);
        if (floorHack) {
            renderSector.zHackFloor = derived(
                [sector.zFloor, leftlines[0].right.sector.zFloor],
                ([left, right]) => right - left);
        }
        // TODO: are there cases were we want the ceiling to do this too?
    }

    // copy render properties from the outer/containing sector
    for (const rs of selfReferencing) {
        // find the sector with the smallest bounds that completely contains this sector. It's a little hack but seems to
        // be good enough(tm) as far as I can tell
        let outerRS = smallestSectorContaining(rs, rSectors);
        if (!outerRS) {
            console.warn('no outer sector for self-referencing sector', rs.sector.num);
            continue;
        }
        rs.flatLighting = outerRS.flatLighting;
        rs.sector = outerRS.sector;
    }

    // transparent door and window hack (https://www.doomworld.com/tutorials/fx5.php)
    for (const linedef of map.linedefs) {
        if (linedef.left) {
            const midL = wad.wallTextureData(linedef.left.middle.val);
            const midR = wad.wallTextureData(linedef.right.middle.val);
            // I'm not sure these conditions are exactly right but it works for TNT MAP02 and MAP09
            // and I've tested a bunch of other maps (in Doom and Doom2) and these hacks don't activate.
            // The "window hack" is particularly sensitive (which is why we have the ===1 condition) but it could
            // also be fixed by adding missing textures on various walls (like https://github.com/ZDoom/gzdoom/blob/master/wadsrc/static/zscript/level_compatibility.zs)
            // but even that list isn't complete
            const zeroHeightWithoutUpperAndLower = (
                linedef.left.sector.zFloor.val === linedef.left.sector.zCeil.val
                && linedef.left.sector !== linedef.right.sector // already covered in self-referencing above
                && linedef.left.sector.ceilFlat.val !== 'F_SKY1' && linedef.right.sector.ceilFlat.val !== 'F_SKY1'
                && !linedef.right.lower.val && !linedef.right.upper.val
                && !linedef.left.lower.val && !linedef.left.upper.val
            );
            const doorHack = zeroHeightWithoutUpperAndLower
                && midL && midL.height === linedef.left.yOffset.val
                && midR && midR.height === linedef.right.yOffset.val;
            const windowHack = zeroHeightWithoutUpperAndLower
                && linedef.right.sector.zCeil.val - linedef.left.sector.zCeil.val === 1
                && !midL && !midR;
            if (!windowHack && !doorHack) {
                continue;
            }

            const rs = rSectors.find(sec => sec.sector === linedef.left.sector);
            rs.zHackFloor = derived(
                [linedef.left.sector.zFloor, linedef.right.sector.zFloor],
                ([left, right]) => right - left);
            linedef.transparentDoorHack = doorHack;
            linedef.transparentWindowHack = windowHack;
            if (doorHack) {
                // a door hack means that two flats will probably overlap. We find the sector that is not the door and
                // overwrite some properties (flats and lighting) to hide the z-fighting. It's definitely a hack.
                map.linedefs
                    .filter(ld => pointOnLine(linedef.v[0], ld.v) && linedef.left.sector.light.val !== ld.right.sector.light.val)
                    .map(ld => rSectors.find(sec => sec.sector === ld.right.sector))
                    .filter(rsec => rsec)
                    .forEach(rsec => {
                        rsec.flatLighting = rs.flatLighting;
                        rsec.sector.floorFlat = rs.sector.floorFlat;
                        rsec.sector.ceilFlat = rs.sector.ceilFlat;
                    });
                rs.zHackCeil = rs.zHackFloor
            }
            if (windowHack) {
                // A window hack (unlike a door hack) doesn't have two sectors BUT we do need to offset the ceiling
                // and floor otherwise the geometry won't line up
                rs.zHackCeil = derived(
                    [linedef.left.sector.zCeil, linedef.right.sector.zCeil],
                    ([left, right]) => right - left);
            }
        }
    }

    // keep render sector mobjs lists in sync with mobjs. The assumption here is that most objects won't change sectors
    // very often therefore it is cheaper to maintain the list this way rather than filtering the mobj list when
    // rendering the sector. On the other hand, we are updating lists when most sectors aren't even visible so...
    // TODO: Need some profiler input here,
    let visitNum = 0;
    let visited = new Map<MapObject, number>();
    let mobjMap = new Map<MapObject, RenderSector>();
    const monitor = (mobj: MapObject) => {
        visited.set(mobj, visitNum);
        if (mobjMap.has(mobj) || mobj.info.flags & MFFlags.MF_NOSECTOR) {
            return;
        }
        mobj.sector.subscribe(sec => {
            const lastRS = mobjMap.get(mobj);
            lastRS?.mobjs.update(s => { s.delete(mobj); return s });
            const nextRS = secMap.get(sec);
            mobjMap.set(mobj, nextRS)
            nextRS.mobjs.update(s => s.add(mobj));
        });
    }
    mapRuntime.rev.subscribe(() => {
        visitNum += 1;
        mapRuntime.objs.forEach(monitor);
        visited.forEach((num, mobj) => {
            if (num !== visitNum) {
                const lastRS = mobjMap.get(mobj);
                lastRS?.mobjs.update(s => { s.delete(mobj); return s });
                mobjMap.delete(mobj);
            }
        });
    });

    console.timeEnd('b-rs')
    return rSectors;
}

function smallestSectorContaining(rs: RenderSector, renderSectors: RenderSector[]) {
    let outerRS: RenderSector;
    let smallestArea = Infinity;
    let innerBound = rs.geometry.boundingBox;
    for (const candidate of renderSectors) {
        if (candidate === rs || !candidate.geometry) {
            continue;
        }

        const outerBounds = candidate.geometry.boundingBox;
        const contained = outerBounds.min.x <= innerBound.min.x && outerBounds.max.x >= innerBound.max.x
            && outerBounds.min.y <= innerBound.min.y && outerBounds.max.y >= innerBound.max.y;
        if (!contained) {
            continue;
        }

        const area = (outerBounds.max.x - outerBounds.min.x) * (outerBounds.max.y - outerBounds.min.y)
        if (area < smallestArea) {
            smallestArea = area;
            outerRS = candidate;
        }
    }
    return outerRS;
}

function createShape(verts: Vertex[]) {
    if (!verts.length) {
        return null;
    }
    const shape = new Shape();
    shape.autoClose = true;
    shape.arcLengthDivisions = 1;
    shape.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) {
        shape.lineTo(verts[i].x, verts[i].y);
    }
    return new ShapeGeometry(shape, 1);
}