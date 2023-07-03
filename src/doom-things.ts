import type { Thing } from "./doomwad";
import { mapObjectInfo, type MapObjectInfo } from './doom-things-info';

// Adapted from https://doomwiki.org/wiki/Thing_types and combined/mixed with
// animation/state info from https://github.com/id-Software/DOOM/blob/master/linuxdoom-1.10/info.c#L135
// (both mobjinfo_t mobjinfo and state_t states)
// alternative? https://doomwiki.org/wiki/Doom_utilities

const monsters = [
    { type: 7, class: 'M', sprite: 'SPID', description: 'Spiderdemon' },
    { type: 9, class: 'M', sprite: 'SPOS', description: 'Shotgun guy' },
    { type: 16, class: 'M', sprite: 'CYBR', description: 'Cyberdemon' },
    { type: 58, class: 'M', sprite: 'SARG', description: 'Spectre' },
    { type: 64, class: 'M', sprite: 'VILE', description: 'Arch-vile' },
    { type: 65, class: 'M', sprite: 'CPOS', description: 'Heavy weapon dude' },
    { type: 66, class: 'M', sprite: 'SKEL', description: 'Revenant' },
    { type: 67, class: 'M', sprite: 'FATT', description: 'Mancubus' },
    { type: 68, class: 'M', sprite: 'BSPI', description: 'Arachnotron' },
    { type: 69, class: 'M', sprite: 'BOS2', description: 'Hell knight' },
    { type: 71, class: 'M', sprite: 'PAIN', description: 'Pain elemental' },
    { type: 72, class: 'M', sprite: 'KEEN', description: 'Commander Keen' },
    { type: 84, class: 'M', sprite: 'SSWV', description: 'Wolfenstein SS' },
    { type: 3001, class: 'M', sprite: 'TROO', description: 'Imp' },
    { type: 3002, class: 'M', sprite: 'SARG', description: 'Demon' },
    { type: 3003, class: 'M', sprite: 'BOSS', description: 'Baron of Hell' },
    { type: 3004, class: 'M', sprite: 'POSS', description: 'Zombieman' },
    { type: 3005, class: 'M', sprite: 'HEAD', description: 'Cacodemon' },
    { type: 3006, class: 'M', sprite: 'SKUL', description: 'Lost soul' },
];

const weapons = [
    { type: 82, class: 'W', sprite: 'SGN2', description: 'Super shotgun' },
    { type: 2001, class: 'W', sprite: 'SHOT', description: 'Shotgun' },
    { type: 2002, class: 'W', sprite: 'MGUN', description: 'Chaingun' },
    { type: 2003, class: 'W', sprite: 'LAUN', description: 'Rocket launcher' },
    { type: 2004, class: 'W', sprite: 'PLAS', description: 'Plasma gun' },
    { type: 2005, class: 'W', sprite: 'CSAW', description: 'Chainsaw' },
    { type: 2006, class: 'W', sprite: 'BFUG', description: 'BFG9000' },
];

const ammunitions = [
    { type: 17, class: 'A', sprite: 'CELP', description: 'Energy cell pack' },
    { type: 2007, class: 'A', sprite: 'CLIP', description: 'Clip' },
    { type: 2008, class: 'A', sprite: 'SHEL', description: '4 shotgun shells' },
    { type: 2010, class: 'A', sprite: 'ROCK', description: 'Rocket' },
    { type: 2046, class: 'A', sprite: 'BROK', description: 'Box of rockets' },
    { type: 2047, class: 'A', sprite: 'CELL', description: 'Energy cell' },
    { type: 2048, class: 'A', sprite: 'AMMO', description: 'Box of bullets' },
    { type: 2049, class: 'A', sprite: 'SBOX', description: 'Box of shotgun shells' },
];

const items = [
    { type: 83, class: 'I', sprite: 'MEGA', description: 'Megasphere' },
    { type: 2013, class: 'I', sprite: 'SOUL', description: 'Supercharge' },
    { type: 2014, class: 'I', sprite: 'BON1', description: 'Health bonus' },
    { type: 2015, class: 'I', sprite: 'BON2', description: 'Armor bonus' },
    { type: 2022, class: 'I', sprite: 'PINV', description: 'Invulnerability' },
    { type: 2023, class: 'I', sprite: 'PSTR', description: 'Berserk' },
    { type: 2024, class: 'I', sprite: 'PINS', description: 'Partial invisibility' },
    { type: 2026, class: 'I', sprite: 'PMAP', description: 'Computer area map' },
    { type: 2045, class: 'I', sprite: 'PVIS', description: 'Light amplification visor' },
];

const powerups = [
    { type: 8, class: 'P', sprite: 'BPAK', description: 'Backpack' },
    { type: 2011, class: 'P', sprite: 'STIM', description: 'Stimpack' },
    { type: 2012, class: 'P', sprite: 'MEDI', description: 'Medikit' },
    { type: 2018, class: 'P', sprite: 'ARM1', description: 'Armor' },
    { type: 2019, class: 'P', sprite: 'ARM2', description: 'Megaarmor' },
    { type: 2025, class: 'P', sprite: 'SUIT', description: 'Radiation shielding suit' },
];

const keys = [
    { type: 5, class: 'K', sprite: 'BKEY', description: 'Blue keycard' },
    { type: 6, class: 'K', sprite: 'YKEY', description: 'Yellow keycard' },
    { type: 13, class: 'K', sprite: 'RKEY', description: 'Red keycard' },
    { type: 38, class: 'K', sprite: 'RSKU', description: 'Red skull key' },
    { type: 39, class: 'K', sprite: 'YSKU', description: 'Yellow skull key' },
    { type: 40, class: 'K', sprite: 'BSKU', description: 'Blue skull key' },
];

const obstacles = [
    { type: 25, class: 'O', sprite: 'POL1', description: 'Impaled human' },
    { type: 26, class: 'O', sprite: 'POL6', description: 'Twitching impaled human' },
    { type: 27, class: 'O', sprite: 'POL4', description: 'Skull on a pole' },
    { type: 28, class: 'O', sprite: 'POL2', description: 'Five skulls "shish kebab"' },
    { type: 29, class: 'O', sprite: 'POL3', description: 'Pile of skulls and candles' },
    { type: 30, class: 'O', sprite: 'COL1', description: 'Tall green pillar' },
    { type: 31, class: 'O', sprite: 'COL2', description: 'Short green pillar' },
    { type: 32, class: 'O', sprite: 'COL3', description: 'Tall red pillar' },
    { type: 33, class: 'O', sprite: 'COL4', description: 'Short red pillar' },
    { type: 35, class: 'O', sprite: 'CBRA', description: 'Candelabra' },
    { type: 36, class: 'O', sprite: 'COL5', description: 'Short green pillar with beating heart' },
    { type: 37, class: 'O', sprite: 'COL6', description: 'Short red pillar with skull' },
    { type: 41, class: 'O', sprite: 'CEYE', description: 'Evil eye' },
    { type: 42, class: 'O', sprite: 'FSKU', description: 'Floating skull' },
    { type: 43, class: 'O', sprite: 'TRE1', description: 'Burnt tree' },
    { type: 44, class: 'O', sprite: 'TBLU', description: 'Tall blue firestick' },
    { type: 45, class: 'O', sprite: 'TGRN', description: 'Tall green firestick' },
    { type: 46, class: 'O', sprite: 'TRED', description: 'Tall red firestick' },
    { type: 47, class: 'O', sprite: 'SMIT', description: 'Brown stump' },
    { type: 48, class: 'O', sprite: 'ELEC', description: 'Tall techno column' },
    { type: 49, class: 'O', sprite: 'GOR1', description: 'Hanging victim, twitching' },
    { type: 50, class: 'O', sprite: 'GOR2', description: 'Hanging victim, arms out' },
    { type: 51, class: 'O', sprite: 'GOR3', description: 'Hanging victim, one- legged' },
    { type: 52, class: 'O', sprite: 'GOR4', description: 'Hanging pair of legs' },
    { type: 53, class: 'O', sprite: 'GOR5', description: 'Hanging leg' },
    { type: 54, class: 'O', sprite: 'TRE2', description: 'Large brown tree' },
    { type: 55, class: 'O', sprite: 'SMBT', description: 'Short blue firestick' },
    { type: 56, class: 'O', sprite: 'SMGT', description: 'Short green firestick' },
    { type: 57, class: 'O', sprite: 'SMRT', description: 'Short red firestick' },
    { type: 70, class: 'O', sprite: 'FCAN', description: 'Burning barrel' },
    { type: 73, class: 'O', sprite: 'HDB1', description: 'Hanging victim, guts removed' },
    { type: 74, class: 'O', sprite: 'HDB2', description: 'Hanging victim, guts and brain removed' },
    { type: 75, class: 'O', sprite: 'HDB3', description: 'Hanging torso, looking down' },
    { type: 76, class: 'O', sprite: 'HDB4', description: 'Hanging torso, open skull' },
    { type: 77, class: 'O', sprite: 'HDB5', description: 'Hanging torso, looking up' },
    { type: 78, class: 'O', sprite: 'HDB6', description: 'Hanging torso, brain removed' },
    { type: 85, class: 'O', sprite: 'TLMP', description: 'Tall techno floor lamp' },
    { type: 86, class: 'O', sprite: 'TLP2', description: 'Short techno floor lamp' },
    { type: 2028, class: 'O', sprite: 'COLU', description: 'Floor lamp' },
    { type: 2035, class: 'O', sprite: 'BAR1', description: 'Exploding barrel' },
];

const decorations = [
    { type: 10, class: 'D', sprite: 'PLAY', description: 'Bloody mess' },
    { type: 12, class: 'D', sprite: 'PLAY', description: 'Bloody mess 2' },
    { type: 15, class: 'D', sprite: 'PLAY', description: 'Dead player' },
    { type: 18, class: 'D', sprite: 'POSS', description: 'Dead former human' },
    { type: 19, class: 'D', sprite: 'SPOS', description: 'Dead former sergeant' },
    { type: 20, class: 'D', sprite: 'TROO', description: 'Dead imp' },
    { type: 21, class: 'D', sprite: 'SARG', description: 'Dead demon' },
    { type: 22, class: 'D', sprite: 'HEAD', description: 'Dead cacodemon' },
    { type: 23, class: 'D', sprite: 'SKUL', description: 'Dead lost soul (invisible)' },
    { type: 24, class: 'D', sprite: 'POL5', description: 'Pool of blood and flesh' },
    { type: 34, class: 'D', sprite: 'CAND', description: 'Candle' },
    { type: 59, class: 'D', sprite: 'GOR2', description: 'Hanging victim, arms out' },
    { type: 60, class: 'D', sprite: 'GOR4', description: 'Hanging pair of legs' },
    { type: 61, class: 'D', sprite: 'GOR3', description: 'Hanging victim, one- legged' },
    { type: 62, class: 'D', sprite: 'GOR5', description: 'Hanging leg' },
    { type: 63, class: 'D', sprite: 'GOR1', description: 'Hanging victim, twitching' },
    { type: 79, class: 'D', sprite: 'POB1', description: 'Pool of blood' },
    { type: 80, class: 'D', sprite: 'POB2', description: 'Pool of blood' },
    { type: 81, class: 'D', sprite: 'BRS1', description: 'Pool of brains' },
];

const other = [
    { type: 1, class: 'S', sprite: 'PLAY', description: 'Player 1 start' },
    { type: 2, class: 'S', sprite: 'PLAY', description: 'Player 2 start' },
    { type: 3, class: 'S', sprite: 'PLAY', description: 'Player 3 start' },
    { type: 4, class: 'S', sprite: 'PLAY', description: 'Player 4 start' },
    { type: 11, class: 'S', sprite: 'none', description: 'Deathmatch start' },
    { type: 14, class: 'S', sprite: 'none4', description: 'Teleport landing' },
    { type: 87, class: 'S', sprite: 'none3', description: 'Spawn spot' },
    { type: 88, class: 'S', sprite: 'BBRN', description: "Romero's head" },
    { type: 89, class: 'S', sprite: 'none1', description: 'Monster spawner' },
];

export interface ThingSpec {
    type: number;
    class: string; //'M' | 'W' | 'A' | 'I' | 'P' | 'K' | 'O' | 'D' | 'S';
    sprite: string;
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