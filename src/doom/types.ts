// A collection of shared types (interfaces and constants)

import type { Vector2, Vector3 } from "three";
import type { Store } from "./Store";
import type { MapObjectInfo, StateIndex } from "./doom-things-info";

export interface Sector {
    num: number;
    rev: Store<number>;
    tag: number;
    type: number;
    zFloor: Store<number>;
    zCeil: Store<number>;
    light: Store<number>;
    floorFlat: Store<string>;
    ceilFlat: Store<string>;
    // part of skyhack
    skyHeight?: number;
    // Game processing data
    specialData: any;
}

export const FF_FULLBRIGHT = 0x8000;
export const FF_FRAMEMASK = 0x7fff;
export interface Sprite {
    name: string;
    frame: number;
    fullbright: boolean;
}


export type ThingType = number;
export interface Thing {
    x: number;
    y: number;
    angle: number;
    type: ThingType;
    flags: number;
}

export interface MapObject {
    readonly id: number;

    readonly source: Thing;
    readonly info: MapObjectInfo;
    readonly health: Store<number>;
    readonly position: Store<Vector3>;
    readonly direction: Store<number>;
    readonly sector: Store<Sector>;
    readonly sprite: Store<Sprite>;
    readonly velocity: Vector3;

    readonly onGround: boolean
}

export interface PlayerMapObject extends MapObject {
    readonly inventory: Store<PlayerInventory>;

    readonly weapon: Store<PlayerWeapon>;
    nextWeapon: PlayerWeapon;
}

export interface Ammo {
    amount: number;
    max: number;
}

export type AmmoType = keyof PlayerInventory['ammo'];

export interface PlayerInventory {
    armor: number;
    ammo: {
        bullets: Ammo;
        shells: Ammo;
        rockets: Ammo;
        cells: Ammo;
    },
    items: {
        invincibilityTicks: number,
        invisibilityTicks: number,
        radiationSuitTicks: number,
        berserkTicks: number,
        nightVisionTicks: number,
        computerMap: boolean,
    }
    // weapons:
    // fist, chainsaw, pistol, shotgun, machine gun, rocket launcher, plasma rifle, bfg
    weapons: PlayerWeapon[];
    // keys
    keys: string; // RYB or RY or B or...
}

export interface PlayerWeapon {
    readonly position: Store<Vector2>;
    readonly sprite: Store<Sprite>;

    readonly num: number,
    readonly ammoType: keyof PlayerInventory['ammo'] | 'none',

    tick(player: PlayerMapObject): void;

    activate(): void;
    ready(): void;
    deactivate(): void;
    fire(): void;
    flash(): void;
}