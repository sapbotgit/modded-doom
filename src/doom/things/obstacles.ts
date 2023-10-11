import { Vector3 } from 'three';
import type { ThingType } from '.';
import { ActionIndex, MFFlags } from '../doom-things-info';
import type { GameTime } from '../game';
import type { MapObject } from '../map-object';

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

const zero = new Vector3();
type StateChangeAction = (time: GameTime, mobj: MapObject) => void
export const actions: { [key: number]: StateChangeAction } = {
    [ActionIndex.A_Explode]: (time, mobj: MapObject) => {
        const damage = 128;
        mobj.map.data.traceBlock(mobj.position.val, zero, damage + 32, hit => {
            if ('mobj' in hit) {
                const thing = hit.mobj;
                if (!(thing.info.flags & MFFlags.MF_SHOOTABLE)) {
                    return true;
                }
                // Boss spider and cyberdemon take no damage from explosions
                if (thing.info.doomednum === 16 || thing.info.doomednum === 7) {
                    return true;
                }

                let dist = Math.max(
                    Math.abs(thing.position.val.x - mobj.position.val.x),
                    Math.abs(thing.position.val.y - mobj.position.val.y)) - thing.info.radius;
                if (dist < 0) {
                    dist = 0;
                }
                if (dist >= damage) {
                    return true; // out of range
                }

                if (hasLineOfSight(thing, mobj)) {
                    thing.damage(damage - dist, mobj, mobj.chaseTarget);
                }
            }
            return true;
        });
    },
}

const losVec = new Vector3();
function hasLineOfSight(mobj1: MapObject, mobj2: MapObject): boolean {
    // P_CheckSight use bsp tree... it would be really nice to use that.
    // TODO: we need to check z-coordinates here and look at two-sided walls, etc.
    let los = true;
    losVec.copy(mobj2.position.val).sub(mobj1.position.val);
    mobj1.map.data.trace(mobj1.position.val, losVec, hit => {
        if ('line' in hit) {
            if ((hit.line.flags & 0x0004) !== 0) {
                return true; // ignore two-sided walls for now
            }
            // we've hit a wall so line of sight is false
            los = false;
            return false;
        }
        // keep searching...
        return true;
    });
    return los;
}