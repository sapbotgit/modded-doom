import { mapObjectInfo, type MapObjectInfo } from './doom-things-info';

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

const weapons = [
    { type: 82, class: 'W', description: 'Super shotgun' },
    { type: 2001, class: 'W', description: 'Shotgun' },
    { type: 2002, class: 'W', description: 'Chaingun' },
    { type: 2003, class: 'W', description: 'Rocket launcher' },
    { type: 2004, class: 'W', description: 'Plasma gun' },
    { type: 2005, class: 'W', description: 'Chainsaw' },
    { type: 2006, class: 'W', description: 'BFG9000' },
];

const ammunitions = [
    { type: 17, class: 'A', description: 'Energy cell pack' },
    { type: 2007, class: 'A', description: 'Clip' },
    { type: 2008, class: 'A', description: '4 shotgun shells' },
    { type: 2010, class: 'A', description: 'Rocket' },
    { type: 2046, class: 'A', description: 'Box of rockets' },
    { type: 2047, class: 'A', description: 'Energy cell' },
    { type: 2048, class: 'A', description: 'Box of bullets' },
    { type: 2049, class: 'A', description: 'Box of shotgun shells' },
];

const items = [
    { type: 83, class: 'I', description: 'Megasphere' },
    { type: 2013, class: 'I', description: 'Supercharge' },
    { type: 2014, class: 'I', description: 'Health bonus' },
    { type: 2015, class: 'I', description: 'Armor bonus' },
    { type: 2022, class: 'I', description: 'Invulnerability' },
    { type: 2023, class: 'I', description: 'Berserk' },
    { type: 2024, class: 'I', description: 'Partial invisibility' },
    { type: 2026, class: 'I', description: 'Computer area map' },
    { type: 2045, class: 'I', description: 'Light amplification visor' },
];

const powerups = [
    { type: 8, class: 'P', description: 'Backpack' },
    { type: 2011, class: 'P', description: 'Stimpack' },
    { type: 2012, class: 'P', description: 'Medikit' },
    { type: 2018, class: 'P', description: 'Armor' },
    { type: 2019, class: 'P', description: 'Megaarmor' },
    { type: 2025, class: 'P', description: 'Radiation shielding suit' },
];

const keys = [
    { type: 5, class: 'K', description: 'Blue keycard' },
    { type: 6, class: 'K', description: 'Yellow keycard' },
    { type: 13, class: 'K', description: 'Red keycard' },
    { type: 38, class: 'K', description: 'Red skull key' },
    { type: 39, class: 'K', description: 'Yellow skull key' },
    { type: 40, class: 'K', description: 'Blue skull key' },
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

export interface ThingSpec {
    type: number;
    class: string; //'M' | 'W' | 'A' | 'I' | 'P' | 'K' | 'O' | 'D' | 'S';
    description: string;
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