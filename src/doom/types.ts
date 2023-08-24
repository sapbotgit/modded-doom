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

export interface SideDef {
    xOffset: Store<number>;
    yOffset: Store<number>;
    sector: Sector;
    upper: Store<string>;
    lower: Store<string>;
    middle: Store<string>;
}

export interface Vertex {
    x: number;
    y: number;
}

export interface LineDef {
    num: number;
    v: Vertex[];
    flags: number;
    special: number;
    tag: number;
    right?: SideDef;
    left?: SideDef;
    // derived
    xOffset?: Store<number>;
    // For game processing
    buttonTimer: any;
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

export interface HandleCollision<Type> {
    (t: Type, side?: -1 | 1): boolean;
}

export interface IDoomMap {
    spawn(mobj: MapObject): void
    trace(start: Vector3, move: Vector3, radius: number, onThing: HandleCollision<MapObject>, onLinedef: HandleCollision<LineDef>): void;
}

export interface MapObject {
    readonly id: number;
    readonly map: IDoomMap;

    readonly source: Thing;
    readonly info: MapObjectInfo;
    readonly health: Store<number>;
    readonly position: Store<Vector3>;
    readonly direction: Store<number>;
    readonly sector: Store<Sector>;
    readonly sprite: Store<Sprite>;
    readonly velocity: Vector3;

    readonly onGround: boolean;

    setState(state: StateIndex): void; // TODO: use store?
}

export interface PlayerMapObject extends MapObject {
    // TODO: merge this with GameInput to really make a good player controller or does that muddle responsibilities?
    attacking: boolean;
    refire: boolean;
    readonly inventory: Store<PlayerInventory>;

    readonly extraLight: Store<number>;
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
    readonly flashSprite: Store<Sprite>;

    readonly num: number,
    readonly ammoType: keyof PlayerInventory['ammo'] | 'none',
    readonly ammoPerShot: number;

    tick(): void;

    activate(player: PlayerMapObject): void;
    ready(): void;
    deactivate(): void;
    fire(): void;
    flash(offset?: number): void;
}