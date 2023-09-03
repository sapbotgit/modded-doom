import { store, type Store } from "./store";
import { thingSpec } from "./things";
import { StateIndex, MFFlags, type MapObjectInfo } from "./doom-things-info";
import { Vector3 } from "three";
import { ToRadians } from "./math";
import { CollisionNoOp, type Sector, type Thing } from "./map-data";
import { ticksPerSecond, type GameTime } from "./game";
import { SpriteStateMachine } from "./sprite";
import type { MapRuntime } from "./map-runtime";
import type { PlayerWeapon } from "./things";

const vec = new Vector3();
const stopVelocity = 0.001;
const friction = .90625;
export class MapObject {
    private static objectCounter = 0;
    readonly id = MapObject.objectCounter++;

    private sect: Sector;

    protected _state = new SpriteStateMachine(
        action => { /* TODO: do action... */ },
        () => this.map.destroy(this));
    protected zFloor: number;

    readonly info: MapObjectInfo;
    readonly health: Store<number>;
    readonly position: Store<Vector3>;
    readonly direction: Store<number>;
    readonly sector = store<Sector>(null);
    readonly sprite = this._state.sprite;
    readonly velocity = new Vector3();

    get onGround() { return this.position.val.z <= this.zFloor; }

    constructor(readonly map: MapRuntime, readonly source: Thing, info?: MapObjectInfo ) {
        this.info = info ?? thingSpec(source.type).mo;
        this.health = store(this.info.spawnhealth);
        const fromCeiling = (this.info.flags & MFFlags.MF_SPAWNCEILING);

        this.direction = store(Math.PI + source.angle * ToRadians);
        this.position = store(new Vector3(source.x, source.y, 0));
        this.position.subscribe(p => {
            const sector = map.data.findSector(p.x, p.y);
            if (!this.sect) {
                // first time setting sector so set zpos
                p.z = sector.zFloor.val;
            }
            // svelte stores assume != when value is an object so we add a little extra smarts
            if (this.sect !== sector) {
                this.sect = sector;
                this.sector.set(sector);
            }
        });

        let floorChange: () => void;
        let ceilChange: () => void;
        this.sector.subscribe(sect => {
            // remove old subscriptions
            floorChange?.();
            ceilChange?.();
            let sectorChange = true;

            ceilChange = sect.zCeil.subscribe(ceil => {
                if (fromCeiling) {
                    this.zFloor = ceil - this.info.height;
                    this.position.val.z = this.zFloor;
                    this.position.set(this.position.val);
                }

                // TODO: also check for crushing/collision?
            });

            floorChange = sect.zFloor.subscribe(floor => {
                if (!fromCeiling) {
                    // check that we are on the ground before updating zFloor because if we were on the ground before
                    // change, we want to force object to the ground after the change
                    const onGround = this.onGround;
                    this.zFloor = floor;
                    if (sectorChange) {
                        // during sector change, don't reset pos.z and let object fall
                        this.applyGravity();
                        sectorChange = false;
                        return;
                    }
                    if (onGround) {
                        this.position.val.z = floor;
                        this.position.set(this.position.val);
                    }
                }

                // TODO: also check for crushing/collision?
            });

            return () => {
                floorChange?.();
                ceilChange?.();
            }
        });

        this._state.setState(this.info.spawnstate);
        // initial spawn sets ticks a little randomly so animations don't all move at the same time
        this._state.randomizeTicks();
    }

    tick() {
        if (this.onGround) {
            // friction (not z because gravity)
            this.velocity.x *= friction;
            this.velocity.y *= friction;
        }
        this.applyGravity();
        this.updatePosition();

        this._state.tick();
    }

    setState(stateIndex: number) {
        this._state.setState(stateIndex);
    }

    teleport(target: Thing, sector: Sector) {
        this.velocity.set(0, 0, 0);
        this.position.val.x = target.x;
        this.position.val.y = target.y;
        this.position.val.z = sector.zFloor.val;
        this.position.set(this.position.val);
        this.direction.set(Math.PI + target.angle * ToRadians);
        // TODO: 18-tick freeze (reaction) time?
    }

    // kind of P_ZMovement
    protected applyGravity() {
        if (this.onGround) {
            this.position.val.z = this.zFloor;
            this.velocity.z = 0;
        } else {
            this.velocity.z -= 1;
        }
    }

    // kind of P_XYMovement
    protected updatePosition() {
        if (this.velocity.lengthSq() < stopVelocity) {
            return;
        }

        this.map.data.xyCollisions(this, this.velocity,
            CollisionNoOp,
            linedef => {
                // slide along wall instead of moving through it
                vec.set(linedef.v[1].x - linedef.v[0].x, linedef.v[1].y - linedef.v[0].y, 0);
                this.velocity.projectOnVector(vec);
                return true;
            },
            CollisionNoOp);
        this.position.update(pos => {
            pos.x += this.velocity.x;
            pos.y += this.velocity.y;
            pos.z += this.velocity.z;
            return pos;
        });
    }
}

const tickingItems: (Exclude<keyof PlayerInventory['items'], 'computerMap'>)[] =
    ['berserkTicks', 'invincibilityTicks', 'invisibilityTicks', 'nightVisionTicks', 'radiationSuitTicks'];

const bobTime = ticksPerSecond / 20;
const playerMaxBob = 16;
const playerViewHeightDefault = 41;
const playerViewHeightDefaultHalf = playerViewHeightDefault * .5;
export class PlayerMapObject extends MapObject {
    private viewHeight = playerViewHeightDefault;
    private deltaViewHeight = 0;

    bob = 0;
    attacking = false;
    refire = false;
    readonly extraLight = store(0);
    readonly weapon = store<PlayerWeapon>(null);
    nextWeapon: PlayerWeapon = null;

    constructor(readonly inventory: Store<PlayerInventory>, map: MapRuntime, source: Thing) {
        super(map, source);

        this.weapon.subscribe(weapon => {
            if (weapon) {
                this.refire = false;
                weapon.activate(this);
            }
        });
    }

    tick() {
        super.tick();

        this.weapon.val.tick();

        this.inventory.update(inv => {
            for (const name of tickingItems) {
                if (inv.items[name]) {
                    inv.items[name] = Math.max(0, inv.items[name] - 1);
                }
            }

            return inv;
        });

        const vel = this.velocity.length();
        if (this._state.index === StateIndex.S_PLAY && vel > .5) {
            this.setState(StateIndex.S_PLAY_RUN1);
        } else if (this._state.index === StateIndex.S_PLAY_RUN1 && vel < .2) {
            this.setState(StateIndex.S_PLAY);
        }
    }

    protected updatePosition(): void {
        // do nothing here because we already update the position in game input and
        // we don't want to double add velocity
    }

    protected applyGravity(): void {
        if (this.map.game.settings.freeFly.val) {
            return;
        }
        // smooth step up
        if (this.position.val.z < this.zFloor) {
            this.viewHeight -= this.zFloor - this.position.val.z;
            // this means we change view height by 1, 2, or 3 depending on the step (>> 3 is equivalent to divide by 8 but faster)
            this.deltaViewHeight = (playerViewHeightDefault - this.viewHeight) >> 3;
        }

        if (this.onGround) {
            if (this.velocity.z < -8) {
                // if we hit the ground hard, drop the screen a bit
                this.deltaViewHeight = this.velocity.z >> 3;
            }
            this.velocity.z = 0;

            if (this.position.val.z !== this.zFloor) {
                this.position.val.z = this.zFloor;
                this.position.set(this.position.val);
            }
        }
    }

    // P_CalcHeight in p_user.c
    computeViewHeight(time: GameTime) {
        const delta = time.delta;
        // if (alive) {
        this.viewHeight += this.deltaViewHeight * 35 * delta;

        if (this.viewHeight > playerViewHeightDefault) {
            this.viewHeight = playerViewHeightDefault;
            this.deltaViewHeight = 0;
        }
        if (this.viewHeight < playerViewHeightDefaultHalf) {
            this.viewHeight = playerViewHeightDefaultHalf;
            if (this.deltaViewHeight <= 0) {
                this.deltaViewHeight = 1;
            }
        }
        if (this.deltaViewHeight) {
            // small acceleration of delta over time
            this.deltaViewHeight += delta / 4;
        }

        if (this.viewHeight < playerViewHeightDefault && this.deltaViewHeight === 0) {
            this.deltaViewHeight = 1;
        }

        this.bob = Math.min(this.velocity.lengthSq(), playerMaxBob);
        const bob = Math.sin(Math.PI * 2 * bobTime * time.elapsed) * this.bob * .5;

        let viewHeight = this.viewHeight + bob;

        // TODO: check higher than ceiling?
        return viewHeight;
    }

    // kind of P_TouchSpecialThing in p_inter.c
    pickup(mobj: MapObject) {
        const spec = thingSpec(mobj.source.type);
        const pickedUp = spec.onPickup?.(this);
        if (pickedUp) {
            this.map.destroy(mobj);
        }
    }
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
