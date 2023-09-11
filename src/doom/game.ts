import { store, type Store } from "./store";
import type { PlayerInventory } from "./map-object";
import { PlayerWeapon, weapons } from "./things";
import type { DoomWad } from "./wad/doomwad";
import type { MapRuntime } from "./map-runtime";

export interface GameTime {
    elapsed: number; // seconds
    delta: number; // seconds
    tick: Store<number>;
    isTick: boolean; // if we have elapsed a tick (1/35 of a second)
}
export interface GameSettings {
    timescale: Store<number>;
    freelook: Store<boolean>;
    noclip: Store<boolean>;
    freeFly: Store<boolean>;
    invicibility: Store<boolean>;
    cameraMode: Store<'1p' | '3p' | 'bird' | 'ortho'>;
}
export type Skill = 1 | 2 | 3 | 4 | 5;

export const ticksPerSecond = 35;
export const frameTickTime = 1 / ticksPerSecond;

// player info persisted between levels
interface PlayerStats extends PlayerInventory {
    health: number;
    lastWeapon: PlayerWeapon;
}

export interface ControllerInput {
    moveForward: boolean;
    moveBackward: boolean;
    moveLeft: boolean;
    moveRight: boolean;
    run: boolean;
    slow: boolean;
    use: boolean;
    attack: boolean;
    weaponSelect: number;
    mouse: { x: number, y: number };
}

export class Game {
    private nextTickTime = 0; // seconds
    time = {
        elapsed: 0,
        delta: 0,
        tick: store(0),
        isTick: false,
    }

    readonly input: ControllerInput = {
        moveForward: false,
        moveBackward: false,
        moveLeft: false,
        moveRight: false,
        run: false,
        slow: false,
        use: false,
        attack: false,
        weaponSelect: 0,
        mouse: { x: 0, y: 0 },
    };
    readonly inventory: PlayerStats = {
        health: 100,
        armor: 0,
        armorType: 0,
        ammo: {
            bullets: { amount: 50, max: 200 },
            shells: { amount: 0, max: 50 },
            rockets: { amount: 0, max: 50 },
            cells: { amount: 0, max: 300 },
        },
        items: {
            berserkTicks: 0,
            invincibilityTicks: 0,
            invisibilityTicks: 0,
            nightVisionTicks: 0,
            radiationSuitTicks: 0,
            computerMap: false,
            berserk: false,
        },
        lastWeapon: weapons['pistol'],
        weapons: [weapons['chainsaw'], weapons['fist'], weapons['pistol']],
        keys: '',
    };
    readonly map = store<MapRuntime>(null);
    readonly nextMap = store<MapRuntime>(null);

    constructor(
        readonly wad: DoomWad,
        readonly skill: Skill,
        readonly settings: GameSettings,
        readonly mode: 'solo' | 'coop' | 'deathmatch' = 'solo',
    ) {}

    tick(delta: number) {
        delta *= this.settings.timescale.val;
        this.time.delta = delta;
        this.time.elapsed += delta;
        this.time.isTick = false;

        // TODO: for large deltas (like a few seconds), we should handle it in smaller
        // chunks so the game logic and animation doesn't get messed up
        // TODO: when loading next map, make sure to clear inventory ticks (invul, light visor)
        //  and bonuses like computer map, berserk, etc.

        if (this.time.elapsed > this.nextTickTime) {
            this.nextTickTime = this.time.elapsed + frameTickTime;
            this.time.tick.update(tick => tick += 1);
            this.time.isTick = true;
        }

        if (this.map.val) {
            this.map.val.timeStep(this.time);
        }
    }
}
