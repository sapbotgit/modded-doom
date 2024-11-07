import { FloatType, InstancedBufferAttribute, InstancedMesh, IntType, Material, Matrix4, Object3D, PlaneGeometry, Quaternion, Vector3 } from "three";
import { HALF_PI, MFFlags, PlayerMapObject, type MapObject } from "../../../doom";
import type { SpriteSheet } from "./SpriteAtlas";
import { inspectorAttributeName } from "../MapMeshMaterial";

// TODO: tidy up parameters here...
export function createSpriteGeometry(spriteSheet: SpriteSheet, material: Material, depthMaterial: Material, distanceMaterial: Material) {
    // Are chunks actually beneficial? It's probably better than resizing/re-initializing a large array
    // but maybe worth experimenting with sometime.
    const chunkSize = 5_000;

    let thingsMeshes: InstancedMesh[] = [];
    const int16BufferFrom = (items: number[], vertexCount: number) => {
        const array = new Uint16Array(items.length * vertexCount);
        for (let i = 0; i < vertexCount * items.length; i += items.length) {
            for (let j = 0; j < items.length; j++) {
                array[i + j] = items[j];
            }
        }
        const attr = new InstancedBufferAttribute(array, items.length);
        attr.gpuType = IntType;
        return attr;
    }

    const floatBufferFrom = (items: number[], vertexCount: number) => {
        const array = new Float32Array(items.length * vertexCount);
        for (let i = 0; i < vertexCount * items.length; i += items.length) {
            for (let j = 0; j < items.length; j++) {
                array[i + j] = items[j];
            }
        }
        const attr = new InstancedBufferAttribute(array, items.length);
        attr.gpuType = FloatType;
        return attr;
    }

    const createChunk = () => {
        const geometry = new PlaneGeometry();
        geometry.rotateX(-HALF_PI);
        const mesh = new InstancedMesh(geometry, material, chunkSize);
        mesh.customDepthMaterial = depthMaterial;
        mesh.customDistanceMaterial = distanceMaterial;
        // sector number that lights this object
        mesh.geometry.setAttribute('doomLight', int16BufferFrom([0], chunkSize));
        mesh.geometry.setAttribute(inspectorAttributeName, int16BufferFrom([-1], chunkSize));
        mesh.geometry.setAttribute('vel', floatBufferFrom([0, 0, 0], chunkSize));
        // [speed/tic, movedir, start tics, direction]
        mesh.geometry.setAttribute('motion', floatBufferFrom([0, 0, 0, 0], chunkSize));
        // texture index and fullbright
        mesh.geometry.setAttribute('texN', int16BufferFrom([0, 0], chunkSize));
        mesh.receiveShadow = mesh.castShadow = castShadows;
        mesh.count = 0;
        // mesh.frustumCulled = false;
        root.add(mesh);
        return mesh;
    }

    interface RenderInfo {
        idx: number;
        mo: MapObject;
        subs: (() => void)[];
    }
    const rmobjs = new Map<number, RenderInfo>();

    const freeSlots: number[] = [];

    const mat = new Matrix4();
    const p = new Vector3( 1, 1, 1 );
    const q = new Quaternion();
    const s = new Vector3( 1, 1, 1 );
    function add(mo: MapObject) {
        let idx = freeSlots.pop() ?? rmobjs.size;

        let m = Math.floor(idx / chunkSize);
        let n = idx % chunkSize;
        if (n === 0 && idx > 0) {
            // this chunk is full
            thingsMeshes[m - 1].count = chunkSize;
        }
        // create new chunk if needed
        if (thingsMeshes.length === m) {
            thingsMeshes.push(createChunk());
            thingsMeshes = thingsMeshes;
        }
        // set count on last chunk (assume everything else stays at chunkSize)
        // NB: count will not decrease because removed items may not be at the end of the list
        thingsMeshes[m].count = Math.max(n + 1, thingsMeshes[m].count);

        const subs = [];
        // mapObject.explode() removes this flag but to offset the sprite properly, we want to preserve it
        const isMissile = mo.info.flags & MFFlags.MF_MISSILE;
        rmobjs.set(mo.id, { mo, idx, subs });
        // custom attributes
        subs.push(mo.sector.subscribe(sec => {
            thingsMeshes[m].geometry.attributes.doomLight.array[n] = sec.num;
            thingsMeshes[m].geometry.attributes.doomLight.needsUpdate = true;
        }));
        subs.push(mo.position.subscribe(pos => {
            // FIXME: this breaks inspector but it makes it easier to scale sprites. Hmm
            s.set(1, 1, 1);
            if (mo instanceof PlayerMapObject) {
                s.set(0, 0, 0);
            }
            p.copy(pos);
            thingsMeshes[m].setMatrixAt(n, mat.compose(p, q, s));
            thingsMeshes[m].instanceMatrix.needsUpdate = true;
            // velocity for interpolation
            thingsMeshes[m].geometry.attributes.vel.array[n * 3 + 0] = mo.velocity.x;
            thingsMeshes[m].geometry.attributes.vel.array[n * 3 + 1] = mo.velocity.y;
            thingsMeshes[m].geometry.attributes.vel.array[n * 3 + 2] = mo.velocity.z;
            thingsMeshes[m].geometry.attributes.vel.needsUpdate = true;
        }));
        subs.push(mo.sprite.subscribe(sprite => {
            if (!sprite) return;
            const spriteIndex = spriteSheet.indexOf(sprite.name, sprite.frame);
            thingsMeshes[m].geometry.attributes.texN.array[n * 2] = spriteIndex;

            // rendering flags
            thingsMeshes[m].geometry.attributes.texN.array[n * 2 + 1] = (
                (sprite.fullbright ? 1 : 0) |
                (isMissile ? 2 : 0) |
                ((mo.info.flags & MFFlags.InvertSpriteYOffset) ? 4 : 0) |
                ((mo.info.flags & MFFlags.MF_SHADOW) ? 8 : 0) |
                ((mo.info.flags & MFFlags.MF_INFLOAT) ? 16 : 0)
            );
            thingsMeshes[m].geometry.attributes.texN.needsUpdate = true;

            // movement info for interpolation
            thingsMeshes[m].geometry.attributes.motion.array[n * 4 + 0] = sprite.ticks ? mo.info.speed / sprite.ticks : 0;
            thingsMeshes[m].geometry.attributes.motion.array[n * 4 + 1] = mo.movedir;
            thingsMeshes[m].geometry.attributes.motion.array[n * 4 + 2] = mo.map.game.time.tick.val + mo.map.game.time.partialTick.val;
            thingsMeshes[m].geometry.attributes.motion.array[n * 4 + 3] = mo.direction.val;
            thingsMeshes[m].geometry.attributes.motion.needsUpdate = true;
        }));

        thingsMeshes[m].geometry.attributes[inspectorAttributeName].array[n] = mo.id;
        thingsMeshes[m].geometry.attributes[inspectorAttributeName].needsUpdate = true;
    }

    function destroy(mo: MapObject) {
        const info = rmobjs.get(mo.id);
        if (!info) {
            return;
        }
        info.subs.forEach(fn => fn());
        rmobjs.delete(mo.id);
        freeSlots.push(info.idx);

        let m = Math.floor(info.idx / chunkSize);
        let n = info.idx % chunkSize;
        // We can't actually remove an instanced geometry but we can hide it until something else uses the free slot.
        // We hide by moving it far away or scaling it very tiny (making it effectively invisible)
        s.set(0, 0, 0);
        thingsMeshes[m].setMatrixAt(n, mat.compose(p, q, s));
        thingsMeshes[m].instanceMatrix.needsUpdate = true;
    }

    let castShadows = false;
    const shadowState = (val: boolean) => {
        castShadows = val;
        thingsMeshes.forEach(m => m.castShadow = m.receiveShadow = castShadows);
    };

    const root = new Object3D();
    return { add, destroy, root, rmobjs, shadowState };
}