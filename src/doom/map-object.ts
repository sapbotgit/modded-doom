import { store, type Store } from "./store";
import { thingSpec, weapons, stateChangeActions } from "./things";
import { StateIndex, MFFlags, type MapObjectInfo, MapObjectIndex, mapObjectInfo } from "./doom-things-info";
import { Vector3 } from "three";
import { randInt, ToRadians } from "./math";
import { type Sector, type Thing } from "./map-data";
import { ticksPerSecond, type GameTime } from "./game";
import { SpriteStateMachine } from "./sprite";
import type { MapRuntime } from "./map-runtime";
import type { PlayerWeapon } from "./things";

export const angleBetween = (mobj1: MapObject, mobj2: MapObject) =>
    Math.atan2(
        mobj1.position.val.y - mobj2.position.val.y,
        mobj1.position.val.x - mobj2.position.val.x);

const vec = new Vector3();
const stopVelocity = 0.001;
const friction = .90625;
let hitCount = 0;
export class MapObject {
    private static objectCounter = 0;
    readonly id = MapObject.objectCounter++;

    protected _state = new SpriteStateMachine(
        action => stateChangeActions[action]?.(this.map.game.time, this),
        () => this.map.destroy(this));
    protected zFloor: number;

    protected _attacker: MapObject;
    get attacker() { return this._attacker; }

    protected _reactiontime: number;
    get reactiontime() { return this._reactiontime; }
    private hitC: number;

    chaseThreshold = 0;
    chaseTarget: MapObject;

    readonly info: MapObjectInfo;
    readonly health: Store<number>;
    readonly position: Store<Vector3>;
    readonly direction: Store<number>;
    readonly sector = store<Sector>(null);
    readonly sprite = this._state.sprite;
    readonly velocity = new Vector3();

    get onGround() { return this.position.val.z <= this.zFloor; }

    constructor(readonly map: MapRuntime, readonly source: Thing, info?: MapObjectInfo ) {
        this.info = {...(info ?? thingSpec(source.type).mo)};
        this.health = store(this.info.spawnhealth);
        const fromCeiling = (this.info.flags & MFFlags.MF_SPAWNCEILING);

        this.direction = store(Math.PI + source.angle * ToRadians);
        this.position = store(new Vector3(source.x, source.y, 0));
        this.position.subscribe(p => {
            const currentSector = this.sector.val;
            const sector = map.data.findSector(p.x, p.y);
            if (!currentSector) {
                // first time setting sector so set zpos
                p.z = sector.zFloor.val;
                if (source.z !== undefined) {
                    p.z = source.z;
                }
            }
            // svelte stores assume != when value is an object so we add a little extra smarts
            if (currentSector !== sector) {
                // TODO: should we do this here or rather when applying gravity?
                if (currentSector && currentSector.zFloor.val - sector.zFloor.val > 24) {
                    // we are stepping off a ledge (not a step), only update the sector if all 4 corners of the AABB in the new sector
                    const nw = map.data.findSector(p.x - this.info.radius, p.y + this.info.radius);
                    const ne = map.data.findSector(p.x + this.info.radius, p.y + this.info.radius);
                    const se = map.data.findSector(p.x + this.info.radius, p.y - this.info.radius);
                    const sw = map.data.findSector(p.x - this.info.radius, p.y - this.info.radius);
                    const allSame = nw === sector && ne === sector && se === sector && sw === sector;
                    if (!allSame) {
                        return;
                    }
                }

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
        this._attacker = null;

        if (this.onGround) {
            // friction (not z because gravity)
            this.velocity.x *= friction;
            this.velocity.y *= friction;
        }
        this.updatePosition();
        this.applyGravity();

        this._state.tick();
    }

    // kind of like P_DamageMobj
    // inflictor is the thing doing damage (thing or missle) or null for slime/crushing
    // source is the thing that shot the missle (or null)
    damage(amount: number, inflictor?: MapObject, source?: MapObject) {
        this._attacker = source;

        if (this.info.flags & MFFlags.MF_SKULLFLY) {
            this.velocity.set(0, 0, 0);
        }

        const shouldApplyThrust = (inflictor
            && !(this.info.flags & MFFlags.MF_NOCLIP)
            && (!source
                || !(source instanceof PlayerMapObject)
                || source.weapon.val !== weapons['chainsaw']));
        if (shouldApplyThrust) {
            let angle = angleBetween(this, inflictor);
            // 12.5 is (100 * (1 << 16 >> 3)) / (1<<16) (see P_DamageMobj)
            let thrust = amount * 12.5 / this.info.mass;
            // as a nifty effect, make fall forwards sometimes on kill shots (when player is below thing they are shooting at)
            const shouldFallForward = (amount < 40
                && amount > this.health.val
                && this.position.val.z - inflictor.position.val.z > 64
                && Math.random() > 0.5);
            if (shouldFallForward) {
                angle += Math.PI;
                thrust *= 4;
            }

            this.velocity.x += thrust * Math.cos(angle);
            this.velocity.y += thrust * Math.sin(angle);
        }

        this.health.update(h => h - amount);
        if (this.health.val <= 0) {
            this.kill(source);
            return;
        }

        this._reactiontime = 0;
        if (Math.random() < this.info.painchance) {
            this.info.flags |= MFFlags.MF_JUSTHIT;
            this.setState(this.info.painstate);
        }

        const setChaseTarget =
            (!this.chaseThreshold || this.info.doomednum == 64)
            && source && this !== source && source.info.doomednum != 64
        if (setChaseTarget) {
            this.chaseTarget = source;
            this.chaseThreshold = 100;
            if (this._state.index === this.info.spawnstate && this.info.seestate !== StateIndex.S_NULL) {
                this.setState(this.info.seestate);
            }
        }
    }

    kill(source?: MapObject) {
        // TODO: this should be moved to A_Fall but we haven't implemented actions for object states (only weapon states)
        this.info.flags &= ~MFFlags.MF_SOLID;

        this.info.flags |= MFFlags.MF_CORPSE | MFFlags.MF_DROPOFF;
        this.info.flags &= ~(MFFlags.MF_SHOOTABLE | MFFlags.MF_FLOAT | MFFlags.MF_SKULLFLY);
        if (this.source.type !== 3006) {
            this.info.flags &= ~MFFlags.MF_NOGRAVITY;
        }

        // TODO: if source is player... do some extra stuff

        this.info.height /= 4;
        if (this.health.val < -this.info.spawnhealth && this.info.xdeathstate !== StateIndex.S_NULL) {
            this._state.setState(this.info.xdeathstate, -randInt(0, 2));
        } else {
            this._state.setState(this.info.deathstate, -randInt(0, 2));
        }

        // Some enemies drop things (guns or ammo) when they die
        let dropType =
            (this.source.type === 84 || this.source.type === 3004) ? MapObjectIndex.MT_CLIP :
            (this.source.type === 9) ? MapObjectIndex.MT_SHOTGUN :
            (this.source.type === 65) ? MapObjectIndex.MT_CHAINGUN :
            null;
        if (dropType) {
            const pos = this.position.val;
            const mo = mapObjectInfo[dropType];
            const mobj = new MapObject(
                this.map, { angle: 0, flags: 0, type: mo.doomednum, x: pos.x, y: pos.y }, mo);
            mobj.info.flags |= MFFlags.MF_DROPPED; // special versions of items
            this.map.spawn(mobj);

            // items pop up when dropped (gzdoom has this effect)
            mobj.velocity.z = randInt(7, 9);
            // position slightly above the current floor otherwise it will immediately stick to floor
            mobj.position.val.z += 1;
        }
    }

    setState(stateIndex: number, tickOffset: number = 0) {
        this._state.setState(stateIndex, tickOffset);
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

    protected pickup(mobj: MapObject) {
        // this is only imlemented by PlayerMapObject (for now)
    }

    // kind of P_ZMovement
    protected applyGravity() {
        if (this.onGround) {
            this.velocity.z = 0;
            this.position.val.z = this.zFloor;
        } else {
            if (this.info.flags & MFFlags.MF_NOGRAVITY) {
                return;
            }
            this.velocity.z -= 1;
        }
    }

    // kind of P_XYMovement
    protected updatePosition() {
        if (this.velocity.lengthSq() < stopVelocity) {
            return
        }

        hitCount += 1;
        const pos = this.position.val;
        let hitFraction = 1;
        while (hitFraction !== -1) {
            hitFraction = -1;
            this.map.data.xyCollisions(this, this.velocity, hit => {
                if ('mobj' in hit) {
                    if (hit.mobj.hitC === hitCount) {
                        return true;
                    }
                    hit.mobj.hitC = hitCount;
                    if (this.info.flags & MFFlags.MF_MISSILE) {
                        // TODO: check z above/below object
                        // TODO: check species (imps don't hit imps, etc.)
                        if (!(hit.mobj.info.flags & MFFlags.MF_SHOOTABLE)) {
                            return !(hit.mobj.info.flags & MFFlags.MF_SOLID);
                        }
                        if (this.chaseTarget === hit.mobj) {
                            return true; // don't hit shooter, continue trace
                        }
                        const damage = randInt(1, 8) * this.info.damage;
                        hit.mobj.damage(damage, this, this.chaseTarget);
                        this.explode();
                        return false;
                    }
                    if (hit.mobj.info.flags & MFFlags.MF_SPECIAL) {
                        this.pickup(hit.mobj);
                        return true;
                    }
                    hitFraction = hit.fraction;
                    const dx = pos.x - hit.mobj.position.val.x;
                    const dy = pos.y - hit.mobj.position.val.y;
                    slideMove(this.velocity, -dy, dx);
                    return false;
                } else if ('special' in hit) {
                    this.map.triggerSpecial(hit.line, this, 'W', hit.side)
                } else if ('line' in hit) {
                    if (hit.line.hitC === hitCount) {
                        return true; // go to next line, we've already hit this one
                    }
                    hit.line.hitC = hitCount;
                    if (this.info.flags & MFFlags.MF_MISSILE) {
                        // TODO: check for sky hit and disappear object instead
                        this.explode();
                        return false;
                    }
                    hitFraction = hit.fraction;
                    slideMove(this.velocity, hit.line.v[1].x - hit.line.v[0].x, hit.line.v[1].y - hit.line.v[0].y);
                    return false;
                }
                return true;
            });
        }
        if (this.velocity.lengthSq() > stopVelocity) {
            this.position.set(pos.add(this.velocity));
        }
    }

    protected explode() {
        this.velocity.set(0, 0, 0);
        this._state.setState(this.info.deathstate, -randInt(0, 2));
        this.info.flags &= ~MFFlags.MF_MISSILE;
        // if (this.info.deathsound)
        // SND: this.info.deathsound
    }
}

const slideMove = (vel: Vector3, x: number, y: number) => {
    // slide along wall instead of moving through it
    vec.set(x, y, 0);
    // we are only interested in cancelling xy movement so preserve z
    const z = vel.z;
    vel.projectOnVector(vec);
    vel.z = z;
};

const tickingItems: (Exclude<keyof PlayerInventory['items'], 'computerMap' | 'berserk'>)[] =
    ['berserkTicks', 'invincibilityTicks', 'invisibilityTicks', 'nightVisionTicks', 'radiationSuitTicks'];

const bobTime = ticksPerSecond / 20;
const playerMaxBob = 16;
const playerViewHeightDefault = 41;
const playerViewHeightDefaultHalf = playerViewHeightDefault * .5;
export class PlayerMapObject extends MapObject {
    private viewHeight = playerViewHeightDefault;
    private deltaViewHeight = 0;

    bob = 0;
    damageCount = 0; // mostly for screen fading
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

        this.damageCount = Math.max(0, this.damageCount - 1);
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

    damage(amount: number, inflictor?: MapObject, source?: MapObject) {
        let inv = this.inventory.val;
        if (inv.items.invincibilityTicks || this.map.game.settings.invicibility.val) {
            // TODO: doom does damage to invincible players if damage is above 1000 but... why?
            // TODO: we still need to apply thrust (super.damage())
            return;
        }
        if (this.map.game.skill === 1) {
            amount *= .5; // half damage in easy skill
        }
        if (inv.armor) {
            let saved = amount / (inv.armorType == 1 ? 3 : 2);
            if (inv.armor <= saved) {
                // armor is used up
                saved = inv.armor;
                inv.armorType = 0;
            }

            inv.armor -= saved;
            this.inventory.set(inv);
            amount -= saved;
        }

        // end of game hell hack
        if (this.sector.val.type == 11 && amount >= this.health.val) {
            amount = this.health.val - 1;
        }

        super.damage(amount, inflictor, source);

        this.damageCount = Math.min(this.damageCount + amount, 100);
        // TODO: haptic feedback for controllers?
    }

    kill(source?: MapObject) {
        super.kill(source);

        // TODO: some map stats and drop weapon
    }

    private get enablePlayerCollisions() { return !this.map.game.settings.noclip.val; }
    xyMove(): void {
        if (this.enablePlayerCollisions) {
            super.updatePosition();
        } else {
            this.position.update(pos => pos.add(this.velocity));
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
    protected pickup(mobj: MapObject) {
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
    armorType: 0 | 1 | 2;
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
        berserk: boolean,
    }
    // weapons:
    // fist, chainsaw, pistol, shotgun, machine gun, rocket launcher, plasma rifle, bfg
    weapons: PlayerWeapon[];
    // keys
    keys: string; // RYB or RY or B or...
}
