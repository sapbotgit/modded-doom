import { MapObjectIndex, mapObjectInfo, type MapObjectInfo } from '../doom-things-info';
import type { MapObject, PlayerMapObject } from '../map-object';
import { weaponItems } from './weapons';
import { monsters } from './monsters';
import { ammunitions } from './ammunitions';
import { items } from './items';
import { powerups } from './powerups';
import { keys } from './keys';
import { obstacles, actions as obstacleActions } from './obstacles';
import { decorations } from './decorations';
import { other } from './other';

export { weapons, weaponTop, PlayerWeapon } from './weapons';

export interface ThingType {
    type: number;
    // Adapted from https://doomwiki.org/wiki/Thing_types
    class:
        'M'   // monster
        | 'W' // weapon
        | 'A' // ammo
        | 'I' // item
        | 'P' // powerup
        | 'K' // key
        | 'O' // obstacle
        | 'D' // decoration
        | 'S'; // player (start/teleport)
    description: string;
    onPickup?: (player: PlayerMapObject, mobj: MapObject) => boolean;
}

export interface ThingSpec extends ThingType {
    mo: MapObjectInfo;
    moType: MapObjectIndex;
}

export const things = [monsters, weaponItems, ammunitions, items, powerups, keys, obstacles, decorations, other].flat();
export function thingSpec(moType: MapObjectIndex): ThingSpec {
    const mo = mapObjectInfo[moType];
    const t = things.find(e => e.type === mo.doomednum);
    return { ...t, moType, mo: mapObjectInfo[moType] };
}

export const stateChangeActions = { ...obstacleActions };