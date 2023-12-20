import { store, type Store } from "./store";
import { PlayerMapObject, type PlayerInventory, MapObject } from "./map-object";
import type { DoomWad } from "./wad/doomwad";
import type { MapRuntime } from "./map-runtime";
import { inventoryWeapon, type InventoryWeapon } from "./things/weapons";
import { Vector3 } from "three";
import { SoundIndex } from "./doom-things-info";
import type { Sector } from "./map-data";

export interface GameTime {
    elapsed: number; // seconds
    delta: number; // seconds
    tick: Store<number>;
    isTick: boolean; // if we have elapsed a tick (1/35 of a second)
}
export interface GameSettings {
    timescale: Store<number>;
    freelook: Store<boolean>;
    zAimAssist: Store<boolean>;
    noclip: Store<boolean>;
    freeFly: Store<boolean>;
    maxLostSouls: Store<number>;
    monsterAI: Store<'enabled' | 'disabled' | 'move-only' | 'fast'>;
    // useful for birds eye view where we may not want to rotate the camera when the player rotates
    compassMove: Store<boolean>;
    invicibility: Store<boolean>;
    cameraMode: Store<'1p' | '3p' | '3p-noclip' | 'bird' | 'ortho' | 'svg'>;
}
export type Skill = 1 | 2 | 3 | 4 | 5;

export const ticksPerSecond = 35;
export const frameTickTime = 1 / ticksPerSecond;

// player info persisted between levels
interface PlayerInfo extends Omit<PlayerInventory, 'keys' | 'items'> {
    health: number;
    lastWeapon: InventoryWeapon;
}

export interface ControllerInput {
    // why vector? so a joystick (or something) can move slower and faster
    move: Vector3;
    aim: Vector3;
    run: boolean;
    slow: boolean;
    use: boolean;
    attack: boolean;
    // select a weapon by slot number (eg. 1 maps to both chainsaw and fist)
    weaponKeyNum: number;
    // directly select a weapon
    weaponIndex: number;
}

export interface IntermissionScreen {
    nextMapName: string;
    finishedMap: MapRuntime;
    playerStats: PlayerMapObject['stats'][];
}

type SoundHandler = (snd: SoundIndex, position?: MapObject | Sector) => void;

export class Game {
    private nextTickTime = 0; // seconds
    time = {
        playTime: 0,
        elapsed: 0,
        delta: 0,
        tick: store(0),
        isTick: false,
    }

    readonly input: ControllerInput = {
        move: new Vector3(),
        aim: new Vector3(),
        run: false,
        slow: false,
        use: false,
        attack: false,
        weaponKeyNum: 0,
        weaponIndex: -1,
    };
    readonly inventory: PlayerInfo = {
        health: 100,
        armor: 0,
        armorType: 0,
        ammo: {
            bullets: { amount: 50, max: 200 },
            shells: { amount: 0, max: 50 },
            rockets: { amount: 0, max: 50 },
            cells: { amount: 0, max: 300 },
        },
        lastWeapon: inventoryWeapon('pistol'),
        // null reserves a slot for the chainsaw to keep weapons in order
        weapons: [null, 'fist', 'pistol'].map(inventoryWeapon),
    };
    readonly map = store<MapRuntime>(null);
    readonly intermission = store<IntermissionScreen>(null);
    get episodic() { return !this.wad.mapNames.includes('MAP01'); }

    constructor(
        readonly wad: DoomWad,
        readonly skill: Skill,
        readonly settings: GameSettings,
        readonly mode: 'solo' | 'coop' | 'deathmatch' = 'solo',
    ) {}

    tick(delta: number) {
        if (delta > 2) {
            // if time is too long (maybe a big GC or switch tab?), just skip it and try again next time
            console.warn('time interval too long', delta);
            return;
        }
        // we need to process in 1/35s ticks (or less)
        delta *= this.settings.timescale.val;
        const step = Math.min(frameTickTime, delta);

        while (delta > 0) {
            const dt = Math.min(step, delta);
            delta -= dt;
            this.time.delta = dt;
            this.time.elapsed += dt;
            this.time.isTick = false;
            if (this.time.elapsed > this.nextTickTime) {
                this.nextTickTime += frameTickTime;
                this.time.tick.update(tick => tick += 1);
                this.time.isTick = true;
            }
            this.map.val?.timeStep(this.time);
        }
    }

    private soundHandler: SoundHandler;
    onSound(handler: SoundHandler) {
        this.soundHandler = handler;
    }
    playSound(snd: SoundIndex, location?: MapObject | Sector) {
        if (snd === SoundIndex.sfx_None) {
            return;
        }
        this.soundHandler?.(snd, location ?? this.map.val?.player);
    }
}
