import { FloatType, InstancedBufferAttribute, InstancedMesh, IntType, Matrix4, Object3D, PlaneGeometry, Quaternion, Vector3 } from "three";
import { HALF_PI, MFFlags, PlayerMapObject, type MapObject, type Sprite  } from "../../../doom";
import type { SpriteSheet } from "./SpriteAtlas";
import { inspectorAttributeName } from "../MapMeshMaterial";
import type { SpriteMaterial } from "./Materials";

// TODO: tidy up parameters here...
export function createSpriteGeometry(spriteSheet: SpriteSheet, material: SpriteMaterial) {
    // What is an ideal chunksize? Chunks are probably better than resizing/re-initializing a large array
    // but would 10,000 be good? 20,000? 1,000? I'm not sure how to measure it.
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
        const mesh = new InstancedMesh(geometry, material.material, chunkSize);
        mesh.customDepthMaterial = material.depthMaterial;
        mesh.customDistanceMaterial = material.distanceMaterial;
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

    const resetGeometry = (cameraMode: string, material: SpriteMaterial) => {
        const ng = new PlaneGeometry();
        if (cameraMode !== 'bird') {
            ng.rotateX(-HALF_PI);
        }
        for (const mesh of thingsMeshes) {
            mesh.material = material.material;
            mesh.customDepthMaterial = material.depthMaterial;
            mesh.customDistanceMaterial = material.distanceMaterial;
            mesh.geometry.attributes.position = ng.attributes.position;
        }
    }

    // Now that we've got some functions here, maybe a class is better? (because we won't create memory for closures?)
    // It would be interesting to measure it though I'm not sure how
    interface RenderInfo {
        mo: MapObject;
        updateSprite: (sprite: Sprite) => void;
        dispose: () => void;
    }
    const rmobjs = new Map<number, RenderInfo>();

    const freeSlots: number[] = [];

    const mat = new Matrix4();
    const p = new Vector3();
    const q = new Quaternion();
    const s = new Vector3();
    const add = (mo: MapObject) => {
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

        // mapObject.explode() removes this flag but to offset the sprite properly, we want to preserve it
        const isMissile = mo.info.flags & MFFlags.MF_MISSILE;

        const updateSprite = (sprite: Sprite) => {
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
        };

        const subs = [];
        const dispose = () => {
            subs.forEach(fn => fn());
            rmobjs.delete(mo.id);
            freeSlots.push(idx);

            // We can't actually remove an instanced geometry but we can hide it until something else uses the free slot.
            // We hide by moving it far away or scaling it very tiny (making it effectively invisible)
            s.set(0, 0, 0);
            thingsMeshes[m].setMatrixAt(n, mat.compose(p, q, s));
            thingsMeshes[m].instanceMatrix.needsUpdate = true;
        };

        rmobjs.set(mo.id, { mo, dispose, updateSprite });

        // custom attributes
        subs.push(mo.sector.subscribe(sec => {
            thingsMeshes[m].geometry.attributes.doomLight.array[n] = sec.num;
            thingsMeshes[m].geometry.attributes.doomLight.needsUpdate = true;
        }));
        subs.push(mo.position.subscribe(pos => {
            // use a fixed size so that inspector can hit objects (in material, we'll have to scale by 1/size)
            s.set(40, 40, 80);
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
        updateSprite(mo.sprite.val);

        thingsMeshes[m].geometry.attributes[inspectorAttributeName].array[n] = mo.id;
        thingsMeshes[m].geometry.attributes[inspectorAttributeName].needsUpdate = true;
    }

    const remove = (mo: MapObject) => {
        const info = rmobjs.get(mo.id);
        if (!info) {
            return;
        }
        info.dispose();
    }

    const get = (mo: MapObject) => rmobjs.get(mo.id);

    const dispose = () => {
        for (const rinfo of rmobjs.values()) {
            rinfo.dispose();
        }
    }

    let castShadows = false;
    const shadowState = (val: boolean) => {
        castShadows = val;
        thingsMeshes.forEach(m => m.castShadow = m.receiveShadow = castShadows);
    };

    const root = new Object3D();
    return { add, remove, get, dispose, root, shadowState, resetGeometry };
}