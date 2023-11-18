import { store, type Store } from "./store";
import { thingSpec, stateChangeAction } from "./things";
import { StateIndex, MFFlags, type MapObjectInfo, MapObjectIndex } from "./doom-things-info";
import { TextureLoader, Vector3 } from "three";
import { HALF_PI, randInt, signedLineDistance, ToRadians, type Vertex } from "./math";
import { hittableThing, zeroVec, type Sector, type SubSector, type Thing } from "./map-data";
import { ticksPerSecond, type GameTime } from "./game";
import { SpriteStateMachine } from "./sprite";
import type { MapRuntime } from "./map-runtime";
import type { PlayerWeapon, ThingSpec } from "./things";
import type { InventoryWeapon } from "./things/weapons";
import { exitLevel } from "./specials";

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

    // check for already hit lines/mobjs
    private hitC: number;
    // set of subsectors we are touching
    private subsecRev = 0;
    private subsectorMap = new Map<SubSector, number>();

    protected _state = new SpriteStateMachine(
        action => stateChangeAction(action, this.map.game.time, this),
        () => this.map.destroy(this));
    protected zFloor = -Infinity;

    protected _attacker: MapObject;
    get attacker() { return this._attacker; }

    // ai stuff
    movedir = 0;
    movecount = 0;
    reactiontime = 0;
    chaseThreshold = 0;
    chaseTarget: MapObject;
    tracerTarget: MapObject;

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

    get isDead() { return this.health.val <= 0; }
    get onGround() { return this.position.val.z <= this.zFloor; }
    get isMonster() { return this.spec.class === 'M'; }
    get type() { return this.spec.moType; }
    get description() { return this.spec.description; }
    get class() { return this.spec.class; }

    constructor(readonly map: MapRuntime, protected spec: ThingSpec, pos: Vertex) {
        // create a copy because we modify stuff (especially flags but also radius, height, maybe mass?)
        this.info = { ...spec.mo };
        this.health = store(this.info.spawnhealth);
        this.reactiontime = map.game.skill === 5 ? 0 : this.info.reactiontime;

        if (this.info.flags & MFFlags.MF_SHADOW) {
            this.renderShadow.set(true);
        }

        this._state.setState(this.info.spawnstate);
        // initial spawn sets ticks a little randomly so animations don't all move at the same time
        this._state.randomizeTicks();

        // only players, monsters, and missiles are moveable which affects how we choose zFloor and zCeil
        const moveable = spec.class === 'M' || (this.info.flags & MFFlags.MF_MISSILE) || spec.moType === MapObjectIndex.MT_PLAYER;
        const highestZFloor = !moveable
            ? (sector: Sector, zFloor: number) => (this.sector.val ?? sector).zFloor.val
            : (sector: Sector, zFloor: number) => {
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
            };

        const lowestZCeil = !moveable
            ? (sector: Sector, zCeil: number) => (this.sector.val ?? sector).zCeil.val
            : (sector: Sector, zCeil: number) => {
                this.subsectors(subsector => {
                    const ceil = (sector === subsector.sector) ? zCeil : subsector.sector.zCeil.val;
                    zCeil = Math.min(ceil, zCeil);
                });
                return zCeil;
            };

        this.canSectorChange = (sector, zFloor, zCeil) => {
            const floor = highestZFloor(sector, zFloor);
            const ceil = lowestZCeil(sector, zCeil);
            return ((ceil - floor) >= this.info.height);
        };

        const fromCeiling = (this.info.flags & MFFlags.MF_SPAWNCEILING);
        this.sectorChanged = sector => {
            // check that we are on the ground before updating zFloor because if we were on the ground before
            // change, we want to force object to the ground after the change
            const onGround = this.onGround;
            this.zFloor = fromCeiling
                ? lowestZCeil(sector, sector.zCeil.val) - this.info.height
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
            // add any subsectors we are currently touching
            map.data.traceSubsectors(p, zeroVec, this.info.radius,
                subsector => Boolean(this.subsectorMap.set(subsector, this.subsecRev)));
            // add mobj to touched sectors or remove from untouched sectors
            this.subsectorMap.forEach((rev, subsector) => {
                if (rev === this.subsecRev && !(this.info.flags & MFFlags.MF_NOBLOCKMAP)) {
                    subsector.mobjs.add(this);
                } else {
                    subsector.mobjs.delete(this);
                    this.subsectorMap.delete(subsector);
                }
            });

            const sector = map.data.findSector(p.x, p.y);
            this.zFloor = fromCeiling && !this.isDead //<-- for keens
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
        // TODO: update movecount?
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
            // as a nifty effect, fall forwards sometimes on kill shots (when player is below thing they are shooting at)
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

        this.reactiontime = 0;
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

    teleport(target: MapObject, sector: Sector) {
        this.velocity.set(0, 0, 0);
        this.position.update(pos => pos.set(target.position.val.x, target.position.val.y, sector.zFloor.val));
        this.direction.set(target.direction.val + Math.PI);

        if (this.isMonster && this.map.name !== 'MAP30') {
            return; // monsters only telefrag in level 30
        }
        // telefrag anything in our way
        this.map.data.traceMove(this.position.val, zeroVec, this.info.radius, hit => {
            if ('mobj' in hit) {
                // skip non hittable things and (obviously) don't hit ourselves
                if (!(hit.mobj.info.flags & hittableThing) || hit.mobj === this) {
                    return true;
                }
                hit.mobj.damage(10_000, this, this);
            }
            return true;
        });
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

        if (this.info.flags & MFFlags.MF_NOCLIP) {
            this.position.update(pos => pos.add(this.velocity));
            return;
        }

        // TODO: we handle blood this way so it doesn't collide with player but... can't we do better?
        if (this.info.spawnstate === StateIndex.S_BLOOD1) {
            this.position.set(this.position.val.add(this.velocity));
            return;
        }

        // cyclomatic complexity of the code below: about 1 bazillion.
        const start = this.position.val;
        hitCount += 1;
        let hitFraction = 1;
        while (hitFraction !== -1) {
            hitFraction = -1;
            vec.copy(start).add(this.velocity);
            this.map.data.traceMove(start, this.velocity, this.info.radius, hit => {
                const isMissile = this.info.flags & MFFlags.MF_MISSILE;

                if ('mobj' in hit) {
                    // kind of like PIT_CheckThing
                    const ignoreHit = (false
                        || (hit.mobj === this) // don't collide with yourself
                        || (!(hit.mobj.info.flags & hittableThing)) // not hittable
                        || (start.z + this.info.height < hit.mobj.position.val.z) // passed under target
                        || (start.z > hit.mobj.position.val.z + hit.mobj.info.height) // passed over target
                        || (hit.mobj.hitC === hitCount) // already hit this mobj
                    );
                    if (ignoreHit) {
                        return true;
                    }
                    hit.mobj.hitC = hitCount;

                    if (isMissile) {
                        if (!(hit.mobj.info.flags & MFFlags.MF_SHOOTABLE)) {
                            return !(hit.mobj.info.flags & MFFlags.MF_SOLID);
                        }
                        if (this.chaseTarget === hit.mobj) {
                            return true; // don't hit shooter, continue trace
                        }
                        // same species does not damage hit.mobj but still explodes missile
                        // this is quite clever because bullets shooters (chaingun guys, shotgun guys, etc.) don't shoot
                        // missiles and therefore will still attack each other
                        const sameSpecies = this.chaseTarget && (
                            this.chaseTarget.type === hit.mobj.type ||
                            (this.chaseTarget.type === MapObjectIndex.MT_KNIGHT && hit.mobj.type === MapObjectIndex.MT_BRUISER)||
                            (this.chaseTarget.type === MapObjectIndex.MT_BRUISER && hit.mobj.type === MapObjectIndex.MT_KNIGHT)
                        );
                        if (!sameSpecies) {
                            const damage = randInt(1, 8) * this.info.damage;
                            hit.mobj.damage(damage, this, this.chaseTarget);
                        }
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
                    const twoSided = Boolean(hit.line.left);
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
                            if (hit.line.special) {
                                this.map.triggerSpecial(hit.line, this, 'G', hit.side);
                            }
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

                    // TODO: hmmm.. if we check for double hits here (after hitting specials), we risk triggering specials multiple times.
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

        this.position.update(pos => pos.add(this.velocity));
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

// interestingly, sector type 4 and 16 CAN hurt even with radiation suit
const superSlimePainChance = 5 / 255;
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
            let lightOverride =
                invunlTime > 1.0 ? 255 :
                // first 2 seconds we go from 0->255 then stay at 255 until last 5 seconds where we pulse a few times from 0 to 255
                nightVisionTime ? (
                    nightVisionTime > 30 ? 255 :
                    nightVisionTime > 28 ? 255 * Math.sin(HALF_PI * Math.max(0, (30 - nightVisionTime) / 2)) :
                    nightVisionTime > 4.5 ? 255 :
                    255 * (Math.sin(Math.PI * 2 * nightVisionTime - HALF_PI) * .5 + .5)
                ) : 0;
            this.extraLight.set(lightOverride);
        });
    }

    tick() {
        super.tick();

        this.reactiontime = Math.max(0, this.reactiontime - 1);
        this.damageCount.update(val => Math.max(0, val - 1));
        this.bonusCount.update(val => Math.max(0, val - 1));
        this.weapon.val.tick();
        if (this.isDead) {
            // TODO: set direction to see our killer
            return;
        }

        this.inventory.update(inv => {
            for (const name of tickingItems) {
                if (inv.items[name]) {
                    inv.items[name] = Math.max(0, inv.items[name] - 1);
                }
            }
            return inv;
        });

        // check special sectors
        const sector = this.sector.val;
        // different from this.onGround because that depends on this.zFloor which takes into account surrounding sector
        // here we are only looking at the sector containing the player center
        const onGround = this.position.val.z <= sector.zFloor.val;
        if (sector.type && onGround) {
            const haveRadiationSuit = this.inventory.val.items.radiationSuitTicks > 0;
            // only cause pain every 31st tick or about .89s
            const isPainTick = (this.map.game.time.tick.val & 0x1f) === 0;
            const causePain = !haveRadiationSuit && isPainTick;
            if (sector.type === 9) {
                this.stats.secrets += 1;
                sector.type = 0;
            } else if (sector.type === 5 && causePain) {
                this.damage(10);
            } else if (sector.type === 7 && causePain) {
                this.damage(5);
            } else if (sector.type === 16 || sector.type === 4) {
                if ((!haveRadiationSuit || Math.random() < superSlimePainChance) && isPainTick) {
                    this.damage(20);
                }
            } else if (sector.type === 11) {
                // TODO: turn off invincibility
                if (causePain) {
                    this.damage(20);
                }
                if (this.health.val < 11) {
                    exitLevel(this, 'normal');
                }
            }
        }

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

        // TODO: some map stats
        this.weapon.val.deactivate();
    }

    teleport(target: MapObject, sector: Sector): void {
        this.reactiontime = 18; // freeze player after teleporting
        super.teleport(target, sector);
    }

    xyMove(): void {
        super.updatePosition();
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
        if (this.isDead) {
            return this.computeDeadViewHeight(time);
        }

        const delta = time.delta;
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

    private computeDeadViewHeight(time: GameTime) {
        // Doom player falls 1 unit per tick (or 35 units per second) until 6 units above the ground so...
        this.viewHeight = Math.max(6, this.viewHeight - 35 * time.delta);
        return this.viewHeight;
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
