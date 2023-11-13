import { Vector3 } from 'three';
import type { ThingType } from '.';
import { ActionIndex, MFFlags, MapObjectIndex } from '../doom-things-info';
import type { GameTime } from '../game';
import { MapObject } from '../map-object';
import { zeroVec } from '../map-data';

export const obstacles: ThingType[] = [
    { type: 25, class: 'O', description: 'Impaled human' },
    { type: 26, class: 'O', description: 'Twitching impaled human' },
    { type: 27, class: 'O', description: 'Skull on a pole' },
    { type: 28, class: 'O', description: 'Five skulls "shish kebab"' },
    { type: 29, class: 'O', description: 'Pile of skulls and candles' },
    { type: 30, class: 'O', description: 'Tall green pillar' },
    { type: 31, class: 'O', description: 'Short green pillar' },
    { type: 32, class: 'O', description: 'Tall red pillar' },
    { type: 33, class: 'O', description: 'Short red pillar' },
    { type: 35, class: 'O', description: 'Candelabra' },
    { type: 36, class: 'O', description: 'Short green pillar with beating heart' },
    { type: 37, class: 'O', description: 'Short red pillar with skull' },
    { type: 41, class: 'O', description: 'Evil eye' },
    { type: 42, class: 'O', description: 'Floating skull' },
    { type: 43, class: 'O', description: 'Burnt tree' },
    { type: 44, class: 'O', description: 'Tall blue firestick' },
    { type: 45, class: 'O', description: 'Tall green firestick' },
    { type: 46, class: 'O', description: 'Tall red firestick' },
    { type: 47, class: 'O', description: 'Brown stump' },
    { type: 48, class: 'O', description: 'Tall techno column' },
    { type: 49, class: 'O', description: 'Hanging victim, twitching' },
    { type: 50, class: 'O', description: 'Hanging victim, arms out' },
    { type: 51, class: 'O', description: 'Hanging victim, one- legged' },
    { type: 52, class: 'O', description: 'Hanging pair of legs' },
    { type: 53, class: 'O', description: 'Hanging leg' },
    { type: 54, class: 'O', description: 'Large brown tree' },
    { type: 55, class: 'O', description: 'Short blue firestick' },
    { type: 56, class: 'O', description: 'Short green firestick' },
    { type: 57, class: 'O', description: 'Short red firestick' },
    { type: 70, class: 'O', description: 'Burning barrel' },
    { type: 73, class: 'O', description: 'Hanging victim, guts removed' },
    { type: 74, class: 'O', description: 'Hanging victim, guts and brain removed' },
    { type: 75, class: 'O', description: 'Hanging torso, looking down' },
    { type: 76, class: 'O', description: 'Hanging torso, open skull' },
    { type: 77, class: 'O', description: 'Hanging torso, looking up' },
    { type: 78, class: 'O', description: 'Hanging torso, brain removed' },
    { type: 85, class: 'O', description: 'Tall techno floor lamp' },
    { type: 86, class: 'O', description: 'Short techno floor lamp' },
    { type: 2028, class: 'O', description: 'Floor lamp' },
    { type: 2035, class: 'O', description: 'Exploding barrel' },
];

type StateChangeAction = (time: GameTime, mobj: MapObject) => void
export const actions: { [key: number]: StateChangeAction } = {
    [ActionIndex.A_Explode]: (time, mobj: MapObject) => {
        const damage = 128;
        // use a map so we don't hit the same object multiple times
        let hits = new Map<MapObject, number>();
        mobj.map.data.traceMove(mobj.position.val, zeroVec, damage + 32, hit => {
            if ('mobj' in hit) {
                if (!(hit.mobj.info.flags & MFFlags.MF_SHOOTABLE)) {
                    return true;
                }
                if (hits.has(hit.mobj)) {
                    return true; // already hit this, so continue to next
                }
                // Boss spider and cyberdemon take no damage from explosions
                if (hit.mobj.type === MapObjectIndex.MT_CYBORG || hit.mobj.type === MapObjectIndex.MT_SPIDER) {
                    return true;
                }

                let dist = Math.max(
                    Math.abs(hit.mobj.position.val.x - mobj.position.val.x),
                    Math.abs(hit.mobj.position.val.y - mobj.position.val.y)) - hit.mobj.info.radius;
                if (dist < 0) {
                    dist = 0;
                }
                if (dist >= damage) {
                    return true; // out of range
                }
                hits.set(hit.mobj, dist);
            }
            return true;
        });

        // don't apply damage in traceMove() because hasLineOfSight() also performs a trace and nested traces don't work
        for (const [hitMobj, dist] of hits.entries()) {
            if (hasLineOfSight(mobj, hitMobj)) {
                hitMobj.damage(damage - dist, mobj, mobj.chaseTarget);
            }
        }
    },
}

const losStart = new Vector3();
const losVec = new Vector3();
function hasLineOfSight(mobj1: MapObject, mobj2: MapObject): boolean {
    // Kind of like P_CheckSight
    let los = true;
    // start from the "eyes" of mobj1 (or about half-height)
    losStart.copy(mobj1.position.val);
    losStart.z += mobj1.info.height * .5;
    losVec.copy(mobj2.position.val).sub(losStart);
    const zTop = mobj2.position.val.z + mobj2.info.height;
    let zMax = (zTop - losStart.z);
    let zMin = (mobj2.position.val.z - losStart.z);

    mobj1.map.data.traceRay(mobj1.position.val, losVec, hit => {
        if ('line' in hit) {
            if (!hit.line.left) {
                // we've hit a solid wall so line of sight is false
                los = false;
                return false;
            }

            const front = hit.side === -1 ? hit.line.right : hit.line.left;
            const back = hit.side === -1 ? hit.line.left : hit.line.right;
            const openTop = Math.min(front.sector.zCeil.val, back.sector.zCeil.val);
            const openBottom = Math.max(front.sector.zFloor.val, back.sector.zFloor.val);
            if (openBottom >= openTop) {
                // it's a two-sided line but there is no opening (eg. a closed door)
                los = false;
                return false;
            }

            if (front.sector.zCeil.val !== back.sector.zCeil.val) {
                zMax = Math.min(zMax, (openTop - zTop));
            }
            if (front.sector.zFloor.val !== back.sector.zFloor.val) {
                zMin = Math.max(zMin, (openBottom - mobj2.position.val.z));
            }

            if (zMax <= zMin) {
                // no room means no line of sight so stop searching
                los = false;
                return false;
            }
        }
        return true; // keep searching...
    });
    return los;
}