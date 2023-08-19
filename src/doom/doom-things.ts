import type { MapObject, PlayerInventory, PlayerMapObject } from './MapObject';
import { mapObjectInfo, type MapObjectInfo } from './doom-things-info';

// pickup functions
// TODO: some unit testing could probably make these cleaner
const updateInventory = (fn: (inv: PlayerInventory) => void) =>
    (player: PlayerMapObject) => {
        player.inventory.update(inv => {
            fn(inv);
            return inv;
        });
        return true;
    }
const addAmmo = (type: keyof PlayerInventory['ammo'], amount: number) =>
    (player: PlayerMapObject) => {
        let added = false;
        player.inventory.update(inv => {
            // TOOD: on nightmare and easy, we should give player double ammo
            if (inv.ammo[type].amount < inv.ammo[type].max) {
                inv.ammo[type].amount = Math.min(inv.ammo[type].amount + amount, inv.ammo[type].max);
                added = true;
            }
            return inv;
        });
        return added;
    }
const addhealth = (amount: number, behaviour: 'always' | 'max100') =>
    (player: PlayerMapObject) => {
        let added = false;
        player.health.update(health => {
            if (behaviour === 'always') {
                health = Math.min(200, health + amount);
                added = true;
            } else if (behaviour === 'max100' && health < 100) {
                health = Math.min(100, health + amount);
                added = true;
            }
            return health;
        })
        return added;
    }

const addKey = (card: string) =>
    (player: PlayerMapObject) => {
        let added = false;
        player.inventory.update(inv => {
            inv.keys += card;
            added = true;
            return inv;
        });
        // TODO: on net games, we don't want to remove keys
        return added;
    }

// Adapted from https://doomwiki.org/wiki/Thing_types and combined/mixed with
// animation/state info from https://github.com/id-Software/DOOM/blob/master/linuxdoom-1.10/info.c#L135
// (both mobjinfo_t mobjinfo and state_t states)
// alternative? https://doomwiki.org/wiki/Doom_utilities

const monsters = [
    { type: 7, class: 'M', description: 'Spiderdemon' },
    { type: 9, class: 'M', description: 'Shotgun guy' },
    { type: 16, class: 'M', description: 'Cyberdemon' },
    { type: 58, class: 'M', description: 'Spectre' },
    { type: 64, class: 'M', description: 'Arch-vile' },
    { type: 65, class: 'M', description: 'Heavy weapon dude' },
    { type: 66, class: 'M', description: 'Revenant' },
    { type: 67, class: 'M', description: 'Mancubus' },
    { type: 68, class: 'M', description: 'Arachnotron' },
    { type: 69, class: 'M', description: 'Hell knight' },
    { type: 71, class: 'M', description: 'Pain elemental' },
    { type: 72, class: 'M', description: 'Commander Keen' },
    { type: 84, class: 'M', description: 'Wolfenstein SS' },
    { type: 3001, class: 'M', description: 'Imp' },
    { type: 3002, class: 'M', description: 'Demon' },
    { type: 3003, class: 'M', description: 'Baron of Hell' },
    { type: 3004, class: 'M', description: 'Zombieman' },
    { type: 3005, class: 'M', description: 'Cacodemon' },
    { type: 3006, class: 'M', description: 'Lost soul' },
];

const weapons: ThingType[] = [
    { type: 82, class: 'W', description: 'Super shotgun' },
    { type: 2001, class: 'W', description: 'Shotgun', onPickup: updateInventory(inv => inv.weapons[3] = true) },
    { type: 2002, class: 'W', description: 'Chaingun', onPickup: updateInventory(inv => inv.weapons[4] = true) },
    { type: 2003, class: 'W', description: 'Rocket launcher', onPickup: updateInventory(inv => inv.weapons[5] = true) },
    { type: 2004, class: 'W', description: 'Plasma gun', onPickup: updateInventory(inv => inv.weapons[6] = true) },
    { type: 2005, class: 'W', description: 'Chainsaw', onPickup: updateInventory(inv => inv.weapons[1] = true) },
    { type: 2006, class: 'W', description: 'BFG9000', onPickup: updateInventory(inv => inv.weapons[7] = true) },
];

const ammunitions: ThingType[] = [
    { type: 17, class: 'A', description: 'Energy cell pack', onPickup: addAmmo('cells', 100) },
    { type: 2007, class: 'A', description: 'Clip', onPickup: addAmmo('bullets', 5) },
    { type: 2008, class: 'A', description: '4 shotgun shells', onPickup: addAmmo('shells', 4) },
    { type: 2010, class: 'A', description: 'Rocket', onPickup: addAmmo('rockets', 1) },
    { type: 2046, class: 'A', description: 'Box of rockets', onPickup: addAmmo('rockets', 5) },
    { type: 2047, class: 'A', description: 'Energy cell', onPickup: addAmmo('cells', 20) },
    { type: 2048, class: 'A', description: 'Box of bullets', onPickup: addAmmo('bullets', 50) },
    { type: 2049, class: 'A', description: 'Box of shotgun shells', onPickup: addAmmo('shells', 20) },
];

const items: ThingType[] = [
    { type: 83, class: 'I', description: 'Megasphere',
        onPickup: (player: PlayerMapObject) => {
            player.health.set(200);
            player.inventory.update(inv => {
                inv.armor = 200;
                return inv;
            });
            return true;
        }
    },
    { type: 2013, class: 'I', description: 'Supercharge', onPickup: addhealth(100, 'always') },
    { type: 2014, class: 'I', description: 'Health bonus', onPickup: addhealth(1, 'always') },
    { type: 2015, class: 'I', description: 'Armor bonus', onPickup: updateInventory(inv => inv.armor += 1) },
    { type: 2022, class: 'I', description: 'Invulnerability', onPickup: updateInventory(inv => inv.items.invincibilityTicks = 30 * 35) },
    { type: 2023, class: 'I', description: 'Berserk', onPickup: updateInventory(inv => inv.items.berserkTicks = 30 * 35) },
    { type: 2024, class: 'I', description: 'Partial invisibility', onPickup: updateInventory(inv => inv.items.invisibilityTicks = 30 * 35) },
    { type: 2026, class: 'I', description: 'Computer area map', onPickup: updateInventory(inv => inv.items.computerMap = true) },
    { type: 2045, class: 'I', description: 'Light amplification visor', onPickup: updateInventory(inv => inv.items.nightVisionTicks = 30 * 35) },
];

const powerups: ThingType[] = [
    { type: 8, class: 'P', description: 'Backpack',
        onPickup: (player: PlayerMapObject) => {
            player.inventory.update(inv => {
                inv.ammo.bullets.max = 400;
                inv.ammo.shells.max = 100;
                inv.ammo.rockets.max = 100;
                inv.ammo.cells.max = 600;

                inv.ammo.bullets.amount = Math.min(inv.ammo.bullets.max, inv.ammo.bullets.amount + 10);
                inv.ammo.shells.amount = Math.min(inv.ammo.shells.max, inv.ammo.shells.amount + 4);
                inv.ammo.rockets.amount = Math.min(inv.ammo.rockets.max, inv.ammo.rockets.amount + 1);
                inv.ammo.cells.amount = Math.min(inv.ammo.cells.max, inv.ammo.cells.amount + 20);
                return inv;
            });
            return true;
        }
    },
    { type: 2011, class: 'P', description: 'Stimpack', onPickup: addhealth(10, 'max100') },
    { type: 2012, class: 'P', description: 'Medikit', onPickup: addhealth(25, 'max100') },
    { type: 2018, class: 'P', description: 'Armor',
        onPickup: (player: PlayerMapObject) => {
            let changed = false;
            player.inventory.update(inv => {
                if (inv.armor < 100) {
                    inv.armor = 100;
                    changed = true;
                }
                return inv;
            });
            return changed;
        },
    },
    { type: 2019, class: 'P', description: 'Megaarmor', onPickup: updateInventory(inv => inv.armor = 200) },
    { type: 2025, class: 'P', description: 'Radiation shielding suit', onPickup: updateInventory(inv => inv.items.radiationSuitTicks = 30 * 35) },
];

const keys: ThingType[] = [
    { type: 5, class: 'K', description: 'Blue keycard', onPickup: addKey('B') },
    { type: 6, class: 'K', description: 'Yellow keycard', onPickup: addKey('Y') },
    { type: 13, class: 'K', description: 'Red keycard', onPickup: addKey('R') },
    { type: 38, class: 'K', description: 'Red skull key', onPickup: addKey('r') },
    { type: 39, class: 'K', description: 'Yellow skull key', onPickup: addKey('y') },
    { type: 40, class: 'K', description: 'Blue skull key', onPickup: addKey('b') },
];

const obstacles = [
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

const decorations = [
    { type: 10, class: 'D', description: 'Bloody mess' },
    { type: 12, class: 'D', description: 'Bloody mess 2' },
    { type: 15, class: 'D', description: 'Dead player' },
    { type: 18, class: 'D', description: 'Dead former human' },
    { type: 19, class: 'D', description: 'Dead former sergeant' },
    { type: 20, class: 'D', description: 'Dead imp' },
    { type: 21, class: 'D', description: 'Dead demon' },
    { type: 22, class: 'D', description: 'Dead cacodemon' },
    { type: 23, class: 'D', description: 'Dead lost soul (invisible)' },
    { type: 24, class: 'D', description: 'Pool of blood and flesh' },
    { type: 34, class: 'D', description: 'Candle' },
    { type: 59, class: 'D', description: 'Hanging victim, arms out' },
    { type: 60, class: 'D', description: 'Hanging pair of legs' },
    { type: 61, class: 'D', description: 'Hanging victim, one- legged' },
    { type: 62, class: 'D', description: 'Hanging leg' },
    { type: 63, class: 'D', description: 'Hanging victim, twitching' },
    { type: 79, class: 'D', description: 'Pool of blood' },
    { type: 80, class: 'D', description: 'Pool of blood' },
    { type: 81, class: 'D', description: 'Pool of brains' },
];

const other = [
    { type: 1, class: 'S', description: 'Player 1 start' },
    { type: 2, class: 'S', description: 'Player 2 start' },
    { type: 3, class: 'S', description: 'Player 3 start' },
    { type: 4, class: 'S', description: 'Player 4 start' },
    { type: 11, class: 'S', description: 'Deathmatch start' },
    { type: 14, class: 'S', description: 'Teleport landing' },
    { type: 87, class: 'S', description: 'Spawn spot' },
    { type: 88, class: 'S', description: "Romero's head" },
    { type: 89, class: 'S', description: 'Monster spawner' },
];

interface ThingType {
    type: number;
    class: string; //'M' | 'W' | 'A' | 'I' | 'P' | 'K' | 'O' | 'D' | 'S';
    description: string;
    onPickup?: (mo: MapObject) => boolean;
}

export interface ThingSpec extends ThingType {
    mo: MapObjectInfo;
}

export const things = [monsters, weapons, ammunitions, items, powerups, keys, obstacles, decorations, other].flat();
export function thingSpec(type: number): ThingSpec {
    const t = things.find(e => e.type === type);
    const mo =
        // special handling for player starts
        (type <= 4 || type === 11) ? mapObjectInfo[0] :
        mapObjectInfo.find(e => e.doomednum === type);
    return { ...t, mo };
}