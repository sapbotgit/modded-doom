import type { Thing } from "./doomwad";

// Adapted from https://doomwiki.org/wiki/Thing_types and combined/mixed with
// animation/state info from https://github.com/id-Software/DOOM/blob/master/linuxdoom-1.10/info.c#L135
// (both mobjinfo_t mobjinfo and state_t states)

export interface ThingSpec {
    type: number;
    radius: number;
    height: number;
    sprite: string;
    sequence: string;
    class: string;
    description: string;
}

const monsters: ThingSpec[] = [
    {
        type: 7,
        radius: 128,
        height: 100,
        sprite: 'SPID',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Spiderdemon'
    },
    {
        type: 9,
        radius: 20,
        height: 56,
        sprite: 'SPOS',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Shotgun guy'
    },
    {
        type: 16,
        radius: 40,
        height: 110,
        sprite: 'CYBR',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Cyberdemon'
    },
    {
        type: 58,
        radius: 30,
        height: 56,
        sprite: 'SARG',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Spectre'
    },
    {
        type: 64,
        radius: 20,
        height: 56,
        sprite: 'VILE',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Arch-vile'
    },
    {
        type: 65,
        radius: 20,
        height: 56,
        sprite: 'CPOS',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Heavy weapon dude'
    },
    {
        type: 66,
        radius: 20,
        height: 56,
        sprite: 'SKEL',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Revenant'
    },
    {
        type: 67,
        radius: 48,
        height: 64,
        sprite: 'FATT',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Mancubus'
    },
    {
        type: 68,
        radius: 64,
        height: 64,
        sprite: 'BSPI',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Arachnotron'
    },
    {
        type: 69,
        radius: 24,
        height: 64,
        sprite: 'BOS2',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Hell knight'
    },
    {
        type: 71,
        radius: 31,
        height: 56,
        sprite: 'PAIN',
        sequence: 'A+',
        class: 'MO*^',
        description: 'Pain elemental'
    },
    {
        type: 72,
        radius: 16,
        height: 72,
        sprite: 'KEEN',
        sequence: 'A+',
        class: 'MO*^',
        description: 'Commander Keen'
    },
    {
        type: 84,
        radius: 20,
        height: 56,
        sprite: 'SSWV',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Wolfenstein SS'
    },
    {
        type: 3001,
        radius: 20,
        height: 56,
        sprite: 'TROO',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Imp'
    },
    {
        type: 3002,
        radius: 30,
        height: 56,
        sprite: 'SARG',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Demon'
    },
    {
        type: 3003,
        radius: 24,
        height: 64,
        sprite: 'BOSS',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Baron of Hell'
    },
    {
        type: 3004,
        radius: 20,
        height: 56,
        sprite: 'POSS',
        sequence: 'AB+',
        class: 'MO*',
        description: 'Zombieman'
    },
    {
        type: 3005,
        radius: 31,
        height: 56,
        sprite: 'HEAD',
        sequence: 'A+',
        class: 'MO*^',
        description: 'Cacodemon'
    },
    {
        type: 3006,
        radius: 16,
        height: 56,
        sprite: 'SKUL',
        sequence: 'AB+',
        class: 'M1O*^',
        description: 'Lost soul'
    },
];

const weapons: ThingSpec[] = [
    {
        type: 82,
        radius: 20,
        height: 16,
        sprite: 'SGN2',
        sequence: 'A',
        class: 'WP1',
        description: 'Super shotgun'
    },
    {
        type: 2001,
        radius: 20,
        height: 16,
        sprite: 'SHOT',
        sequence: 'A',
        class: 'WP1',
        description: 'Shotgun'
    },
    {
        type: 2002,
        radius: 20,
        height: 16,
        sprite: 'MGUN',
        sequence: 'A',
        class: 'WP1',
        description: 'Chaingun'
    },
    {
        type: 2003,
        radius: 20,
        height: 16,
        sprite: 'LAUN',
        sequence: 'A',
        class: 'WP1',
        description: 'Rocket launcher'
    },
    {
        type: 2004,
        radius: 20,
        height: 16,
        sprite: 'PLAS',
        sequence: 'A',
        class: 'WP1',
        description: 'Plasma gun'
    },
    {
        type: 2005,
        radius: 20,
        height: 16,
        sprite: 'CSAW',
        sequence: 'A',
        class: 'WP2',
        description: 'Chainsaw'
    },
    {
        type: 2006,
        radius: 20,
        height: 16,
        sprite: 'BFUG',
        sequence: 'A',
        class: 'WP1',
        description: 'BFG9000'
    },

    // Ammunition
    {
        type: 17,
        radius: 20,
        height: 16,
        sprite: 'CELP',
        sequence: 'A',
        class: 'P1',
        description: 'Energy cell pack'
    },
    {
        type: 2007,
        radius: 20,
        height: 16,
        sprite: 'CLIP',
        sequence: 'A',
        class: 'P1',
        description: 'Clip'
    },
    {
        type: 2008,
        radius: 20,
        height: 16,
        sprite: 'SHEL',
        sequence: 'A',
        class: 'P1',
        description: '4 shotgun shells'
    },
    {
        type: 2010,
        radius: 20,
        height: 16,
        sprite: 'ROCK',
        sequence: 'A',
        class: 'P1',
        description: 'Rocket'
    },
    {
        type: 2046,
        radius: 20,
        height: 16,
        sprite: 'BROK',
        sequence: 'A',
        class: 'P1',
        description: 'Box of rockets'
    },
    {
        type: 2047,
        radius: 20,
        height: 16,
        sprite: 'CELL',
        sequence: 'A',
        class: 'P1',
        description: 'Energy cell'
    },
    {
        type: 2048,
        radius: 20,
        height: 16,
        sprite: 'AMMO',
        sequence: 'A',
        class: 'P1',
        description: 'Box of bullets'
    },
    {
        type: 2049,
        radius: 20,
        height: 16,
        sprite: 'SBOX',
        sequence: 'A',
        class: 'P1',
        description: 'Box of shotgun shells'
    },
];

const items: ThingSpec[] = [
    {
        type: 83,
        radius: 20,
        height: 16,
        sprite: 'MEGA',
        sequence: 'ABCD',
        class: 'AP',
        description: 'Megasphere'
    },
    {
        type: 2013,
        radius: 20,
        height: 16,
        sprite: 'SOUL',
        sequence: 'ABCDCB',
        class: 'AP',
        description: 'Supercharge'
    },
    {
        type: 2014,
        radius: 20,
        height: 16,
        sprite: 'BON1',
        sequence: 'ABCDCB',
        class: 'AP',
        description: 'Health bonus'
    },
    {
        type: 2015,
        radius: 20,
        height: 16,
        sprite: 'BON2',
        sequence: 'ABCDCB',
        class: 'AP',
        description: 'Armor bonus'
    },
    {
        type: 2022,
        radius: 20,
        height: 16,
        sprite: 'PINV',
        sequence: 'ABCD',
        class: 'AP',
        description: 'Invulnerability'
    },
    {
        type: 2023,
        radius: 20,
        height: 16,
        sprite: 'PSTR',
        sequence: 'A',
        class: 'AP',
        description: 'Berserk'
    },
    {
        type: 2024,
        radius: 20,
        height: 16,
        sprite: 'PINS',
        sequence: 'ABCD',
        class: 'AP',
        description: 'Partial invisibility'
    },
    {
        type: 2026,
        radius: 20,
        height: 16,
        sprite: 'PMAP',
        sequence: 'ABCDCB',
        class: 'AP1',
        description: 'Computer area map'
    },
    {
        type: 2045,
        radius: 20,
        height: 16,
        sprite: 'PVIS',
        sequence: 'AB',
        class: 'AP',
        description: 'Light amplification visor'
    },
];

const powerups: ThingSpec[] = [
    {
        type: 8,
        radius: 20,
        height: 16,
        sprite: 'BPAK',
        sequence: 'A',
        class: 'P',
        description: 'Backpack'
    },
    {
        type: 2011,
        radius: 20,
        height: 16,
        sprite: 'STIM',
        sequence: 'A',
        class: 'P3',
        description: 'Stimpack'
    },
    {
        type: 2012,
        radius: 20,
        height: 16,
        sprite: 'MEDI',
        sequence: 'A',
        class: 'P3',
        description: 'Medikit'
    },
    {
        type: 2018,
        radius: 20,
        height: 16,
        sprite: 'ARM1',
        sequence: 'AB',
        class: 'P1',
        description: 'Armor'
    },
    {
        type: 2019,
        radius: 20,
        height: 16,
        sprite: 'ARM2',
        sequence: 'AB',
        class: 'P2',
        description: 'Megaarmor'
    },
    {
        type: 2025,
        radius: 20,
        height: 16,
        sprite: 'SUIT',
        sequence: 'A',
        class: 'P',
        description: 'Radiation shielding suit'
    },
];

const keys: ThingSpec[] = [
    {
        type: 5,
        radius: 20,
        height: 16,
        sprite: 'BKEY',
        sequence: 'AB',
        class: 'P',
        description: 'Blue keycard'
    },
    {
        type: 6,
        radius: 20,
        height: 16,
        sprite: 'YKEY',
        sequence: 'AB',
        class: 'P',
        description: 'Yellow keycard'
    },
    {
        type: 13,
        radius: 20,
        height: 16,
        sprite: 'RKEY',
        sequence: 'AB',
        class: 'P',
        description: 'Red keycard'
    },
    {
        type: 38,
        radius: 20,
        height: 16,
        sprite: 'RSKU',
        sequence: 'AB',
        class: 'P',
        description: 'Red skull key'
    },
    {
        type: 39,
        radius: 20,
        height: 16,
        sprite: 'YSKU',
        sequence: 'AB',
        class: 'P',
        description: 'Yellow skull key'
    },
    {
        type: 40,
        radius: 20,
        height: 16,
        sprite: 'BSKU',
        sequence: 'AB',
        class: 'P',
        description: 'Blue skull key'
    },
];

const obstacles: ThingSpec[] = [
    {
        type: 25,
        radius: 16,
        height: 16,
        sprite: 'POL1',
        sequence: 'A',
        class: 'O',
        description: 'Impaled human'
    },
    {
        type: 26,
        radius: 16,
        height: 16,
        sprite: 'POL6',
        sequence: 'AB',
        class: 'O',
        description: 'Twitching impaled human'
    },
    {
        type: 27,
        radius: 16,
        height: 16,
        sprite: 'POL4',
        sequence: 'A',
        class: 'O',
        description: 'Skull on a pole'
    },
    {
        type: 28,
        radius: 16,
        height: 16,
        sprite: 'POL2',
        sequence: 'A',
        class: 'O',
        description: 'Five skulls "shish kebab"'
    },
    {
        type: 29,
        radius: 16,
        height: 16,
        sprite: 'POL3',
        sequence: 'AB',
        class: 'O',
        description: 'Pile of skulls and candles'
    },
    {
        type: 30,
        radius: 16,
        height: 16,
        sprite: 'COL1',
        sequence: 'A',
        class: 'O',
        description: 'Tall green pillar'
    },
    {
        type: 31,
        radius: 16,
        height: 16,
        sprite: 'COL2',
        sequence: 'A',
        class: 'O',
        description: 'Short green pillar'
    },
    {
        type: 32,
        radius: 16,
        height: 16,
        sprite: 'COL3',
        sequence: 'A',
        class: 'O',
        description: 'Tall red pillar'
    },
    {
        type: 33,
        radius: 16,
        height: 16,
        sprite: 'COL4',
        sequence: 'A',
        class: 'O',
        description: 'Short red pillar'
    },
    {
        type: 35,
        radius: 16,
        height: 16,
        sprite: 'CBRA',
        sequence: 'A',
        class: 'O',
        description: 'Candelabra'
    },
    {
        type: 36,
        radius: 16,
        height: 16,
        sprite: 'COL5',
        sequence: 'AB',
        class: 'O',
        description: 'Short green pillar with beating heart'
    },
    {
        type: 37,
        radius: 16,
        height: 16,
        sprite: 'COL6',
        sequence: 'A',
        class: 'O',
        description: 'Short red pillar with skull'
    },
    {
        type: 41,
        radius: 16,
        height: 16,
        sprite: 'CEYE',
        sequence: 'ABCB',
        class: 'O',
        description: 'Evil eye'
    },
    {
        type: 42,
        radius: 16,
        height: 16,
        sprite: 'FSKU',
        sequence: 'ABC',
        class: 'O',
        description: 'Floating skull'
    },
    {
        type: 43,
        radius: 16,
        height: 16,
        sprite: 'TRE1',
        sequence: 'A',
        class: 'O',
        description: 'Burnt tree'
    },
    {
        type: 44,
        radius: 16,
        height: 16,
        sprite: 'TBLU',
        sequence: 'ABCD',
        class: 'O',
        description: 'Tall blue firestick'
    },
    {
        type: 45,
        radius: 16,
        height: 16,
        sprite: 'TGRN',
        sequence: 'ABCD',
        class: 'O',
        description: 'Tall green firestick'
    },
    {
        type: 46,
        radius: 16,
        height: 16,
        sprite: 'TRED',
        sequence: 'ABCD',
        class: 'O',
        description: 'Tall red firestick'
    },
    {
        type: 47,
        radius: 16,
        height: 16,
        sprite: 'SMIT',
        sequence: 'A',
        class: 'O',
        description: 'Brown stump'
    },
    {
        type: 48,
        radius: 16,
        height: 16,
        sprite: 'ELEC',
        sequence: 'A',
        class: 'O',
        description: 'Tall techno column'
    },
    {
        type: 49,
        radius: 16,
        height: 68,
        sprite: 'GOR1',
        sequence: 'ABCB',
        class: 'O^',
        description: 'Hanging victim, twitching'
    },
    {
        type: 50,
        radius: 16,
        height: 84,
        sprite: 'GOR2',
        sequence: 'A',
        class: 'O^',
        description: 'Hanging victim, arms out'
    },
    {
        type: 51,
        radius: 16,
        height: 84,
        sprite: 'GOR3',
        sequence: 'A',
        class: 'O^',
        description: 'Hanging victim, one- legged'
    },
    {
        type: 52,
        radius: 16,
        height: 68,
        sprite: 'GOR4',
        sequence: 'A',
        class: 'O^',
        description: 'Hanging pair of legs'
    },
    {
        type: 53,
        radius: 16,
        height: 52,
        sprite: 'GOR5',
        sequence: 'A',
        class: 'O^',
        description: 'Hanging leg'
    },
    {
        type: 54,
        radius: 32,
        height: 16,
        sprite: 'TRE2',
        sequence: 'A',
        class: 'O',
        description: 'Large brown tree'
    },
    {
        type: 55,
        radius: 16,
        height: 16,
        sprite: 'SMBT',
        sequence: 'ABCD',
        class: 'O',
        description: 'Short blue firestick'
    },
    {
        type: 56,
        radius: 16,
        height: 16,
        sprite: 'SMGT',
        sequence: 'ABCD',
        class: 'O',
        description: 'Short green firestick'
    },
    {
        type: 57,
        radius: 16,
        height: 16,
        sprite: 'SMRT',
        sequence: 'ABCD',
        class: 'O',
        description: 'Short red firestick'
    },
    {
        type: 70,
        radius: 16,
        height: 16,
        sprite: 'FCAN',
        sequence: 'ABC',
        class: 'O',
        description: 'Burning barrel'
    },
    {
        type: 73,
        radius: 16,
        height: 88,
        sprite: 'HDB1',
        sequence: 'A',
        class: 'O^',
        description: 'Hanging victim, guts removed'
    },
    {
        type: 74,
        radius: 16,
        height: 88,
        sprite: 'HDB2',
        sequence: 'A',
        class: 'O^',
        description: 'Hanging victim, guts and brain removed'
    },
    {
        type: 75,
        radius: 16,
        height: 64,
        sprite: 'HDB3',
        sequence: 'A',
        class: 'O^',
        description: 'Hanging torso, looking down'
    },
    {
        type: 76,
        radius: 16,
        height: 64,
        sprite: 'HDB4',
        sequence: 'A',
        class: 'O^',
        description: 'Hanging torso, open skull'
    },
    {
        type: 77,
        radius: 16,
        height: 64,
        sprite: 'HDB5',
        sequence: 'A',
        class: 'O^',
        description: 'Hanging torso, looking up'
    },
    {
        type: 78,
        radius: 16,
        height: 64,
        sprite: 'HDB6',
        sequence: 'A',
        class: 'O^',
        description: 'Hanging torso, brain removed'
    },
    {
        type: 85,
        radius: 16,
        height: 16,
        sprite: 'TLMP',
        sequence: 'ABCD',
        class: 'O',
        description: 'Tall techno floor lamp'
    },
    {
        type: 86,
        radius: 16,
        height: 16,
        sprite: 'TLP2',
        sequence: 'ABCD',
        class: 'O',
        description: 'Short techno floor lamp'
    },
    {
        type: 2028,
        radius: 16,
        height: 16,
        sprite: 'COLU',
        sequence: 'A',
        class: 'O',
        description: 'Floor lamp'
    },
    {
        type: 2035,
        radius: 10,
        height: 42,
        sprite: 'BAR1',
        sequence: 'AB',
        class: 'O*',
        description: 'Exploding barrel'
    },
];

const decorations: ThingSpec[] = [
    {
        type: 10,
        radius: 20,
        height: 16,
        sprite: 'PLAY',
        sequence: 'W',
        class: '',
        description: 'Bloody mess'
    },
    {
        type: 12,
        radius: 20,
        height: 16,
        sprite: 'PLAY',
        sequence: 'W',
        class: '',
        description: 'Bloody mess 2'
    },
    {
        type: 15,
        radius: 20,
        height: 16,
        sprite: 'PLAY',
        sequence: 'N',
        class: '',
        description: 'Dead player'
    },
    {
        type: 18,
        radius: 20,
        height: 16,
        sprite: 'POSS',
        sequence: 'L',
        class: '',
        description: 'Dead former human'
    },
    {
        type: 19,
        radius: 20,
        height: 16,
        sprite: 'SPOS',
        sequence: 'L',
        class: '',
        description: 'Dead former sergeant'
    },
    {
        type: 20,
        radius: 20,
        height: 16,
        sprite: 'TROO',
        sequence: 'M',
        class: '',
        description: 'Dead imp'
    },
    {
        type: 21,
        radius: 20,
        height: 16,
        sprite: 'SARG',
        sequence: 'N',
        class: '',
        description: 'Dead demon'
    },
    {
        type: 22,
        radius: 20,
        height: 16,
        sprite: 'HEAD',
        sequence: 'L',
        class: '',
        description: 'Dead cacodemon'
    },
    {
        type: 23,
        radius: 20,
        height: 16,
        sprite: 'SKUL',
        sequence: 'K',
        class: '',
        description: 'Dead lost soul (invisible)'
    },
    {
        type: 24,
        radius: 20,
        height: 16,
        sprite: 'POL5',
        sequence: 'A',
        class: '',
        description: 'Pool of blood and flesh'
    },
    {
        type: 34,
        radius: 20,
        height: 16,
        sprite: 'CAND',
        sequence: 'A',
        class: '',
        description: 'Candle'
    },
    {
        type: 59,
        radius: 20,
        height: 84,
        sprite: 'GOR2',
        sequence: 'A',
        class: '^',
        description: 'Hanging victim, arms out'
    },
    {
        type: 60,
        radius: 20,
        height: 68,
        sprite: 'GOR4',
        sequence: 'A',
        class: '^',
        description: 'Hanging pair of legs'
    },
    {
        type: 61,
        radius: 20,
        height: 52,
        sprite: 'GOR3',
        sequence: 'A',
        class: '^',
        description: 'Hanging victim, one- legged'
    },
    {
        type: 62,
        radius: 20,
        height: 52,
        sprite: 'GOR5',
        sequence: 'A',
        class: '^',
        description: 'Hanging leg'
    },
    {
        type: 63,
        radius: 20,
        height: 68,
        sprite: 'GOR1',
        sequence: 'ABCB',
        class: '^',
        description: 'Hanging victim, twitching'
    },
    {
        type: 79,
        radius: 20,
        height: 16,
        sprite: 'POB1',
        sequence: 'A',
        class: '',
        description: 'Pool of blood'
    },
    {
        type: 80,
        radius: 20,
        height: 16,
        sprite: 'POB2',
        sequence: 'A',
        class: '',
        description: 'Pool of blood'
    },
    {
        type: 81,
        radius: 20,
        height: 16,
        sprite: 'BRS1',
        sequence: 'A',
        class: '',
        description: 'Pool of brains '
    },
];

const other: ThingSpec[] = [
    {
        type: 1,
        radius: 16,
        height: 56,
        sprite: 'PLAY',
        sequence: 'A+',
        class: '',
        description: 'Player 1 start'
    },
    {
        type: 2,
        radius: 16,
        height: 56,
        sprite: 'PLAY',
        sequence: 'A+',
        class: '',
        description: 'Player 2 start'
    },
    {
        type: 3,
        radius: 16,
        height: 56,
        sprite: 'PLAY',
        sequence: 'A+',
        class: '',
        description: 'Player 3 start'
    },
    {
        type: 4,
        radius: 16,
        height: 56,
        sprite: 'PLAY',
        sequence: 'A+',
        class: '',
        description: 'Player 4 start'
    },
    {
        type: 11,
        radius: 16,
        height: 56,
        sprite: 'none',
        sequence: '-',
        class: '',
        description: 'Deathmatch start'
    },
    {
        type: 14,
        radius: 20,
        height: 16,
        sprite: 'none4',
        sequence: '-',
        class: '',
        description: 'Teleport landing'
    },
    {
        type: 87,
        radius: 20,
        height: 32,
        sprite: 'none3',
        sequence: '-',
        class: '',
        description: 'Spawn spot'
    },
    {
        type: 88,
        radius: 16,
        height: 16,
        sprite: 'BBRN',
        sequence: 'A+',
        class: 'O2*',
        description: "Romero's head"
    },
    {
        type: 89,
        radius: 20,
        height: 32,
        sprite: 'none1',
        sequence: '-',
        class: '',
        description: 'Monster spawner'
    },
];

const things = [monsters, weapons, items, powerups, keys, obstacles, decorations, other].flat();
export function thingSpec(thing: Thing) {
    return things.find(e => e.type === thing.type);
}