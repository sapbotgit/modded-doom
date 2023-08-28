import { mapObjectInfo, type MapObjectInfo } from '../doom-things-info';
import type { PlayerMapObject } from '../map-object';
import { weaponItems } from './weapons';
import { monsters } from './monsters';
import { ammunitions } from './ammunitions';
import { items } from './items';
import { powerups } from './powerups';
import { keys } from './keys';
import { obstacles } from './obstacles';
import { decorations } from './decorations';
import { other } from './other';

export { weapons, weaponTop, PlayerWeapon } from './weapons';

export interface ThingType {
    type: number;
    // Adapted from https://doomwiki.org/wiki/Thing_types
    class: 'M' | 'W' | 'A' | 'I' | 'P' | 'K' | 'O' | 'D' | 'S';
    description: string;
    onPickup?: (mo: PlayerMapObject) => boolean;
}

export interface ThingSpec extends ThingType {
    mo: MapObjectInfo;
}

export const things = [monsters, weaponItems, ammunitions, items, powerups, keys, obstacles, decorations, other].flat();
export function thingSpec(type: number): ThingSpec {
    const t = things.find(e => e.type === type);
    const mo =
        // special handling for player starts
        (type <= 4 || type === 11) ? mapObjectInfo[0] :
        mapObjectInfo.find(e => e.doomednum === type);
    return { ...t, mo };
}