import { Vector3 } from 'three';
import type { ThingType } from '.';
import { ActionIndex, MFFlags } from '../doom-things-info';
import type { GameTime } from '../game';
import type { MapObject } from '../map-object';
import { lineLineIntersect } from '../math';

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
        // P_RadiusAttack ( thingy, thingy->target, 128 );
        const damage = 128;
        mobj.map.data.blockmap.radiusTrace(mobj.position.val, damage + 32, block => {
            for (const thing of block.things) {
                if (!(thing.info.flags & MFFlags.MF_SHOOTABLE)) {
                    continue;
                }
                // Boss spider and cyberdemon take no damage from explosions
                if (thing.info.doomednum === 16 || thing.info.doomednum === 7) {
                    continue;
                }

                let dist = Math.max(
                    Math.abs(thing.position.val.x - mobj.position.val.x),
                    Math.abs(thing.position.val.y - mobj.position.val.y)) - thing.info.radius;
                if (dist < 0) {
                    dist = 0;
                }
                if (dist >= damage) {
                    continue; // out of range
                }

                if (hasLineOfSight(thing, mobj)) {
                    thing.damage(damage - dist, mobj, mobj.chaseTarget);
                }
            }
            // always trace all blocks
            return true;
        });
    },
}

const losVec = new Vector3();
function hasLineOfSight(mobj1: MapObject, mobj2: MapObject): boolean {
    // P_CheckSight use bsp tree... it would be really nice to use that.
    // Also we need to check z-coordinates here and look at two-sided walls, etc.
    let los = true;
    const line = [mobj1.position.val, mobj2.position.val];
    losVec.copy(mobj2.position.val).sub(mobj1.position.val);
    mobj1.map.data.blockmap.trace2(mobj1.position.val, losVec, (block, bounds) => {
        for (const linedef of block.linedefs) {
            const hit = lineLineIntersect(line, linedef.v, true);
            const validHit = (hit
                && hit.x > bounds.left && hit.x < bounds.right
                && hit.y > bounds.top && hit.y < bounds.bottom);
            if (validHit) {
                // we've hit a wall so line of sight is false
                los = false;
                return false;
            }
        }
        // keep searching next block
        return true;
    });
    return los;
}