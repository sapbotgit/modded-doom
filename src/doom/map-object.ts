import { store, type Store } from "./store";
import { thingSpec, stateChangeActions } from "./things";
import { StateIndex, MFFlags, type MapObjectInfo, MapObjectIndex } from "./doom-things-info";
import { Vector3 } from "three";
import { randInt, signedLineDistance, ToRadians, type Vertex } from "./math";
import { hittableThing, zeroVec, type Sector, type SubSector, type Thing } from "./map-data";
import { ticksPerSecond, type GameTime } from "./game";
import { SpriteStateMachine } from "./sprite";
import type { MapRuntime } from "./map-runtime";
import type { PlayerWeapon, ThingSpec } from "./things";
import type { InventoryWeapon } from "./things/weapons";

export const angleBetween = (mobj1: MapObject, mobj2: MapObject) =>
    Math.atan2(
        mobj1.position.val.y - mobj2.position.val.y,
        mobj1.position.val.x - mobj2.position.val.x);

const vec = new Vector3();
const maxStepSize = 24;
const stopVelocity = 0.001;
const friction = .90625;
let hitCount = 0;
export class MapObject {
    private static objectCounter = 0;
    readonly id = MapObject.objectCounter++;

    // set of subsectors we are touching
    private subsecRev = 0;
    private subsectorMap = new Map<SubSector, number>();

    protected _state = new SpriteStateMachine(
        action => stateChangeActions[action]?.(this.map.game.time, this),
        () => this.map.destroy(this));
    protected zFloor = -Infinity;

    protected _attacker: MapObject;
    get attacker() { return this._attacker; }

    protected _reactiontime: number;
    get reactiontime() { return this._reactiontime; }
    private hitC: number;

    chaseThreshold = 0;
    chaseTarget: MapObject;

    readonly canSectorChange: (sector: Sector, zFloor: number, zCeil: number) => boolean;
    readonly sectorChanged: (sector: Sector) => void;

    readonly info: MapObjectInfo;
    readonly health: Store<number>;
    readonly position: Store<Vector3>;
    readonly direction: Store<number>;
    readonly sector = store<Sector>(null);
    readonly sprite = this._state.sprite;
    readonly velocity = new Vector3();
    readonly renderShadow = store(false);

    get onGround() { return this.position.val.z <= this.zFloor; }
    get isMonster() { return this.spec.class === 'M'; }
    get type() { return this.spec.moType; }
    get description() { return this.spec.description; }
    get class() { return this.spec.class; }

    constructor(readonly map: MapRuntime, protected spec: ThingSpec, pos: Vertex) {
        // create a copy because we modify stuff (especially flags but also radius, height, maybe mass?)
        this.info = { ...spec.mo };
        this.health = store(this.info.spawnhealth);
        const fromCeiling = (this.info.flags & MFFlags.MF_SPAWNCEILING);

        if (this.info.flags & MFFlags.MF_SHADOW) {
            this.renderShadow.set(true);
        }

        this._state.setState(this.info.spawnstate);
        // initial spawn sets ticks a little randomly so animations don't all move at the same time
        this._state.randomizeTicks();

        const highestZFloor = (sector: Sector, zFloor: number) => {
            const ceil = lowestZCeil(sector, sector.zCeil.val);
            this.subsectors(subsector => {
                const floor = (sector === subsector.sector) ? zFloor : subsector.sector.zFloor.val;
                const step = floor - this.position.val.z;
                // only allow step if it's small and we can fit in the ceiling/floor gap
                // (see imp near sector 75 in E1M7)
                if (step >= 0 && step <= maxStepSize && ceil - floor >= this.info.height) {
                    zFloor = Math.max(floor, zFloor);
                }
            });
            return zFloor;
        }

        const lowestZCeil = (sector: Sector, zCeil: number) => {
            this.subsectors(subsector => {
                const ceil = (sector === subsector.sector) ? zCeil : subsector.sector.zCeil.val;
                zCeil = Math.min(ceil, zCeil);
            });
            return zCeil;
        }

        this.canSectorChange = (sector, zFloor, zCeil) => {
            const floor = highestZFloor(sector, zFloor);
            const ceil = lowestZCeil(sector, zCeil);
            return ((ceil - floor) >= this.info.height);
        };

        this.sectorChanged = sector => {
            // check that we are on the ground before updating zFloor because if we were on the ground before
            // change, we want to force object to the ground after the change
            const onGround = this.onGround;
            this.zFloor = fromCeiling
                ? sector.zCeil.val - this.info.height
                : highestZFloor(sector, sector.zFloor.val);
            // ceiling things or things on the ground always update
            if (fromCeiling || onGround) {
                this.position.val.z = this.zFloor;
                this.position.set(this.position.val);
            }
        };

        this.direction = store(0);
        this.position = store(new Vector3(pos.x, pos.y, 0));
        this.position.subscribe(p => {
            this.subsecRev += 1;
            // NOTE: we subtract .1 from radius because if we use the full radius we don't get doom like behaviour for
            // our objects. This is most notable in Doom2's MAP20 torches in the cyber/spider room but it happens in many
            // other places. Slightly reducing the side makes this much better.
            const traceRadius = this.info.radius - .1
            // add any subsectors we are currently touching
            map.data.traceSubsectors(p, zeroVec, traceRadius, subsector =>
                Boolean(this.subsectorMap.set(subsector, this.subsecRev)));
            // add mobj to touched sectors or remove from untouched sectors
            this.subsectorMap.forEach((rev, subsector) => {
                if (rev === this.subsecRev) {
                    subsector.mobjs.add(this);
                } else {
                    subsector.mobjs.delete(this);
                    this.subsectorMap.delete(subsector);
                }
            });

            const sector = map.data.findSector(p.x, p.y);
            this.zFloor = fromCeiling
                ? lowestZCeil(sector, sector.zCeil.val) - this.info.height
                // we want the sector with the highest floor which means we float a little when standing on an edge
                : highestZFloor(sector, sector.zFloor.val);
            if (!this.sector.val) {
                // first time setting sector so set zpos based on sector containing the object center
                p.z = sector.zFloor.val;
            }
            if (this.sector.val !== sector) {
                this.sector.set(sector);
                this.applyGravity();
            }
        });
    }

    tick() {
        this._attacker = null;

        // apply friction when on the ground (and we're not a missle/lost soul)
        if (this.onGround && !(this.info.flags & (MFFlags.MF_MISSILE | MFFlags.MF_SKULLFLY))) {
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
                || source.weapon.val.name !== 'chainsaw'));
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
        if (this.type !== MapObjectIndex.MT_SKULL) {
            this.info.flags &= ~MFFlags.MF_NOGRAVITY;
        }

        if (this.info.flags & MFFlags.MF_COUNTKILL) {
            const player =
                source instanceof PlayerMapObject ? source :
                this.map.game.mode === 'solo' ? this.map.player : null;
            if (player) {
                player.stats.kills += 1;
            }
            // TODO: netgames need to do more (like count frags)
        }

        this.info.height *= .25;
        if (this.health.val < -this.info.spawnhealth && this.info.xdeathstate !== StateIndex.S_NULL) {
            this._state.setState(this.info.xdeathstate, -randInt(0, 2));
        } else {
            this._state.setState(this.info.deathstate, -randInt(0, 2));
        }

        // Some enemies drop things (guns or ammo) when they die
        let dropType =
            (this.type === MapObjectIndex.MT_WOLFSS || this.type === MapObjectIndex.MT_POSSESSED) ? MapObjectIndex.MT_CLIP :
            (this.type === MapObjectIndex.MT_SHOTGUY) ? MapObjectIndex.MT_SHOTGUN :
            (this.type === MapObjectIndex.MT_CHAINGUY) ? MapObjectIndex.MT_CHAINGUN :
            null;
        if (dropType) {
            const pos = this.position.val;
            const mobj = this.map.spawn(dropType, pos.x, pos.y);
            mobj.info.flags |= MFFlags.MF_DROPPED; // special versions of items

            // items pop up when dropped (gzdoom has this effect and I think it's pretty cool)
            mobj.velocity.z = randInt(5, 7);
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

    touchingSector(sector: Sector) {
        for (const subsector of this.subsectorMap.keys()) {
            if (subsector.sector === sector) {
                return true;
            }
        }
        return false;
    }

    subsectors(fn: (subsector: SubSector) => void) {
        this.subsectorMap.forEach((val, key) => fn(key));
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
            return;
        }

        // TODO: we handle blood this way so it doesn't collide with player but... can't we do better?
        if (this.info.spawnstate === StateIndex.S_BLOOD1) {
            this.position.set(this.position.val.add(this.velocity));
            return;
        }

        const start = this.position.val;
        hitCount += 1;
        const pos = this.position.val;
        let hitFraction = 1;
        while (hitFraction !== -1) {
            hitFraction = -1;
            vec.copy(start).add(this.velocity);
            this.map.data.traceMove(start, this.velocity, this.info.radius, hit => {
                const isMissile = this.info.flags & MFFlags.MF_MISSILE;

                if ('mobj' in hit) {
                    // kind of like PIT_CheckThing
                    if (hit.mobj === this) {
                        return true; // don't collide with yourself
                    }
                    if (!(hit.mobj.info.flags & hittableThing)) {
                        return true; // not hittable
                    }
                    if (start.z + this.info.height < hit.mobj.position.val.z) {
                        return true; // passed under target
                    }
                    if (start.z > hit.mobj.position.val.z + hit.mobj.info.height) {
                        return true; // passed over target
                    }
                    if (hit.mobj.hitC === hitCount) {
                        return true;
                    }
                    hit.mobj.hitC = hitCount;
                    if (isMissile) {
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
                    if (hit.axis === 'y') {
                        slideMove(this.velocity, 1, 0);
                    } else {
                        slideMove(this.velocity, 0, 1);
                    }
                    return false;
                } else if ('line' in hit) {
                    const isMissile = this.info.flags & MFFlags.MF_MISSILE;
                    const twoSided = (hit.line.flags & 0x0004) !== 0;
                    if (isMissile) {
                        let explode = false;
                        if (twoSided) {
                            const front = (hit.side === -1 ? hit.line.right : hit.line.left).sector;
                            const back = (hit.side === -1 ? hit.line.left : hit.line.right).sector;
                            if (hitSky(start.z, front, back)) {
                                this.map.destroy(this);
                                return false;
                            }

                            explode = explode || (start.z < back.zFloor.val);
                            explode = explode || (start.z + this.info.height > back.zCeil.val);
                        }

                        if (!twoSided || explode) {
                            this.explode();
                            return false;
                        }
                        return true;
                    }

                    const blocking = (hit.line.flags & 0x0001) !== 0;
                    if (twoSided && !blocking) {
                        const endSect = hit.side < 0 ? hit.line.left.sector : hit.line.right.sector;

                        const floorChangeOk = (endSect.zFloor.val - start.z <= maxStepSize);
                        const transitionGapOk = (endSect.zCeil.val - start.z >= this.info.height);
                        const newCeilingFloorGapOk = (endSect.zCeil.val - endSect.zFloor.val >= this.info.height);
                        const dropOffOk =
                            (this.info.flags & (MFFlags.MF_DROPOFF | MFFlags.MF_FLOAT)) ||
                            (start.z - endSect.zFloor.val <= maxStepSize);

                        // console.log('[sz,ez], [f,t,cf,do]',[start.z, endSect.zFloor.val], [floorChangeOk,transitionGapOk,newCeilingFloorGapOk,dropOffOk])
                        if (newCeilingFloorGapOk && transitionGapOk && floorChangeOk && dropOffOk) {
                            if (hit.line.special) {
                                const startSide = signedLineDistance(hit.line.v, start) < 0 ? -1 : 1;
                                const endSide = signedLineDistance(hit.line.v, vec) < 0 ? -1 : 1
                                if (startSide !== endSide) {
                                    this.map.triggerSpecial(hit.line, this, 'W', hit.side)
                                }
                            }

                            return true; // step/ceiling/drop-off collision is okay so try next line
                        }
                    }

                    // TODO: hmmm.. if we check for double hits here, we risk triggering specials multiple times.
                    // maybe we should trigger specials after this? (that is how doom actually does it)
                    if (hit.line.hitC === hitCount) {
                        // we've already hit this wall? stop moving because we're in a concave corner (e1m1 imp platform or e1m3 near blue key door)
                        this.velocity.set(0, 0, 0);
                        return true;
                    }
                    hit.line.hitC = hitCount;

                    hitFraction = hit.fraction;
                    slideMove(this.velocity, hit.line.v[1].x - hit.line.v[0].x, hit.line.v[1].y - hit.line.v[0].y);
                    return false;
                } else if ('flat' in hit) {
                    // hit a floor or ceiling
                    if (isMissile) {
                        this.explode();
                        return false;
                    }
                }
                return true;
            });
        }

        this.position.set(pos.add(this.velocity));
    }

    protected explode() {
        this.velocity.set(0, 0, 0);
        this._state.setState(this.info.deathstate, -randInt(0, 2));
        this.info.flags &= ~MFFlags.MF_MISSILE;
        // if (this.info.deathsound)
        // SND: this.info.deathsound
    }
}

export const hitSky = (z: number, front: Sector, back: Sector) =>
    (front.ceilFlat.val === 'F_SKY1') && (
        (z > front.zCeil.val) ||
        (back && z > back.zCeil.val && back.skyHeight !== undefined && back.skyHeight !== back.zCeil.val)
);

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
    damageCount = store(0); // mostly for screen fading
    bonusCount = store(0); // mostly for screen fading
    attacking = false;
    refire = false;
    readonly stats = {
        kills: 0,
        items: 0,
        secrets: 0,
    };
    readonly extraLight = store(0);
    readonly weapon = store<PlayerWeapon>(null);
    nextWeapon: InventoryWeapon = null;

    constructor(readonly inventory: Store<PlayerInventory>, map: MapRuntime, source: Thing) {
        super(map, thingSpec(MapObjectIndex.MT_PLAYER), source);
        this.direction.set(Math.PI + source.angle * ToRadians);

        this.renderShadow.subscribe(shadow => {
            if (shadow) {
                this.info.flags |= MFFlags.MF_SHADOW;
            } else {
                this.info.flags &= ~MFFlags.MF_SHADOW;
            }
        });

        this.inventory.subscribe(inv => {
            const invisibleTime = inv.items.invisibilityTicks / ticksPerSecond;
            this.renderShadow.set(invisibleTime > 0);

            const nightVisionTime = inv.items.nightVisionTicks / ticksPerSecond;
            const invunlTime = inv.items.invincibilityTicks / ticksPerSecond;
            // invulnTime is partly coordinated with ScreenColorShader.ts
            const isFullBright = invunlTime > 1.0 || nightVisionTime > 5 || nightVisionTime % 2 > 1;
            this.extraLight.set(isFullBright ? 255 : 0);
        });

        this.sector.subscribe(sector => {
            if (sector.type === 9) {
                this.stats.secrets += 1;
                sector.type = 0;
            }
        });
    }

    tick() {
        super.tick();

        this.damageCount.update(val => Math.max(0, val - 1));
        this.bonusCount.update(val => Math.max(0, val - 1));
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

        this.damageCount.update(val => Math.min(val + amount, 100));
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
        const maxHeight = this.sector.val.zCeil.val - 4 - this.position.val.z;
        return Math.min(maxHeight, viewHeight);
    }

    // kind of P_TouchSpecialThing in p_inter.c
    protected pickup(mobj: MapObject) {
        const pickedUp = (mobj as any).spec.onPickup?.(this, mobj);
        if (pickedUp) {
            this.stats.items += mobj.info.flags & MFFlags.MF_COUNTITEM ? 1 : 0;
            this.bonusCount.update(val => val + 6);
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
    // weapons: chainsaw, fist, pistol, [super shotgun,] shotgun, machine gun, rocket launcher, plasma rifle, bfg
    weapons: InventoryWeapon[];
    // keys
    keys: string; // RYB or RY or B or...
}
