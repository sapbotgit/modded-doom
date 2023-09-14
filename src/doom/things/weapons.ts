import { Vector2, Vector3 } from "three";
import type { ThingType } from ".";
import { ActionIndex, MFFlags, MapObjectIndex, StateIndex, mapObjectInfo } from "../doom-things-info";
import { store } from "../store";
import { HALF_PI, ToDegrees, randInt } from '../math';
import { type PlayerMapObject, type PlayerInventory, MapObject, angleBetween } from '../map-object';
import { SpriteStateMachine } from '../sprite';
import { giveAmmo } from "./ammunitions";
import { ticksPerSecond, type GameTime } from "../game";
import type { HandleTraceHit, LineDef } from "../map-data";

export const weaponTop = 32;
const weaponBottom = 32 - 128;

export class PlayerWeapon {
    private player: PlayerMapObject;
    private _sprite = new SpriteStateMachine(
        action => weaponActions[action]?.(this.player.map.game.time, this.player, this),
        self => self.sprite.set(null));
    private _flashSprite = new SpriteStateMachine(
        action => weaponActions[action]?.(this.player.map.game.time, this.player, this),
        self => self.sprite.set(null));
    readonly position = store<Vector2>(new Vector2(0, weaponBottom));
    readonly sprite = this._sprite.sprite;
    readonly flashSprite = this._flashSprite.sprite;

    constructor(
        readonly num: number,
        readonly ammoType: keyof PlayerInventory['ammo'] | 'none',
        readonly ammoPerShot: number,
        private upState: StateIndex,
        private downState: StateIndex,
        private readyState: StateIndex,
        private attackState: StateIndex,
        private flashState: StateIndex,
    ) {}

    tick() {
        this._sprite.tick();
        this._flashSprite.tick();
    }

    activate(player: PlayerMapObject) {
        this.player = player;
        this._sprite.setState(this.upState);
    }
    deactivate() { this._sprite.setState(this.downState); }
    ready() { this._sprite.setState(this.readyState); }
    flash(offset = 0) { this._flashSprite.setState(this.flashState + offset); }
    fire() {
        if (this.player.nextWeapon) {
            // once weapon is down, nextWeapon will be activated
            this.deactivate();
            return;
        }

        if (this.ammoType === 'none' || this.player.inventory.val.ammo[this.ammoType].amount >= this.ammoPerShot) {
            this.player.setState(StateIndex.S_PLAY_ATK1);
            this._sprite.setState(this.attackState);
        }
    }
}

export const weapons = {
    'chainsaw': new PlayerWeapon(1, 'none', 0, StateIndex.S_SAWUP, StateIndex.S_SAWDOWN, StateIndex.S_SAW, StateIndex.S_SAW1, StateIndex.S_NULL),
    'fist': new PlayerWeapon(1, 'none', 0, StateIndex.S_PUNCHUP, StateIndex.S_PUNCHDOWN, StateIndex.S_PUNCH, StateIndex.S_PUNCH1, StateIndex.S_NULL),
    'pistol': new PlayerWeapon(2, 'bullets', 1, StateIndex.S_PISTOLUP, StateIndex.S_PISTOLDOWN, StateIndex.S_PISTOL, StateIndex.S_PISTOL1, StateIndex.S_PISTOLFLASH),
    'super shotgun': new PlayerWeapon(3, 'shells', 2, StateIndex.S_DSGUNUP, StateIndex.S_DSGUNDOWN, StateIndex.S_DSGUN, StateIndex.S_DSGUN1, StateIndex.S_DSGUNFLASH1),
    'shotgun': new PlayerWeapon(3, 'shells', 1, StateIndex.S_SGUNUP, StateIndex.S_SGUNDOWN, StateIndex.S_SGUN, StateIndex.S_SGUN1, StateIndex.S_SGUNFLASH1),
    'chaingun': new PlayerWeapon(4, 'bullets', 1, StateIndex.S_CHAINUP, StateIndex.S_CHAINDOWN, StateIndex.S_CHAIN, StateIndex.S_CHAIN1, StateIndex.S_CHAINFLASH1),
    'rocket launcher': new PlayerWeapon(5, 'rockets', 1, StateIndex.S_MISSILEUP, StateIndex.S_MISSILEDOWN, StateIndex.S_MISSILE, StateIndex.S_MISSILE1, StateIndex.S_MISSILEFLASH1),
    'plasma rifle': new PlayerWeapon(6, 'cells', 1, StateIndex.S_PLASMAUP, StateIndex.S_PLASMADOWN, StateIndex.S_PLASMA, StateIndex.S_PLASMA1, StateIndex.S_PLASMAFLASH1),
    'bfg': new PlayerWeapon(7, 'cells', 40, StateIndex.S_BFGUP, StateIndex.S_BFGDOWN, StateIndex.S_BFG, StateIndex.S_BFG1, StateIndex.S_BFGFLASH1),
};

export const weaponItems: ThingType[] = [
    { type: 82, class: 'W', description: 'Super shotgun', onPickup: giveWeapon(weapons['super shotgun']) },
    { type: 2001, class: 'W', description: 'Shotgun', onPickup: giveWeapon(weapons['shotgun']) },
    { type: 2002, class: 'W', description: 'Chaingun', onPickup: giveWeapon(weapons['chaingun']) },
    { type: 2003, class: 'W', description: 'Rocket launcher', onPickup: giveWeapon(weapons['rocket launcher']) },
    { type: 2004, class: 'W', description: 'Plasma gun', onPickup: giveWeapon(weapons['plasma rifle']) },
    { type: 2005, class: 'W', description: 'Chainsaw', onPickup: giveWeapon(weapons['chainsaw']) },
    { type: 2006, class: 'W', description: 'BFG9000', onPickup: giveWeapon(weapons['bfg']) },
];

function giveWeapon(weapon: PlayerWeapon) {
    return (player: PlayerMapObject) => {
        player.inventory.update(inv => {
            if (weapon.ammoType !== 'none') {
                // TODO: only give 1 clip for droped weapon
                giveAmmo(player, inv, weapon.ammoType, 2);
            }
            if (!inv.weapons.includes(weapon)) {
                // keep weapons in order
                inv.weapons.push(weapon);
                player.nextWeapon = weapon;
            }
            return inv;
        });
        // TODO: keep weapons for net games
        return true;
    }
}

const meleeRange = 1 * 64;
const scanRange = 16 * 64;
const attackRange = 32 * 64;
const angleNoise = (radius: number) => (Math.random() - Math.random()) * (Math.PI / radius);
const bulletDamage = () => 5 * randInt(1, 4);

const weaponBobTime = 128 / ticksPerSecond;
// TODO: I'd actually like to remove these from ActionIndex and instead make them completely local to weapon.ts
// I'd like to do the same thing with StateIndex (move all weapon states to this file so that all weapon related stuff
// is isolated from other things). Long term, we could also move enemy and other bits to their own files too so that
// all the declarations for a type of "thing" are in a single place. Something to aspire to.
type WeaponAction = (time: GameTime, player: PlayerMapObject, weapon: PlayerWeapon) => void
const weaponActions: { [key: number]: WeaponAction } = {
    [ActionIndex.NULL]: (time, player, weapon) => {},
    [ActionIndex.A_Light0]: (time, player, weapon) => {
        player.extraLight.set(0);
    },
    [ActionIndex.A_Light1]: (time, player, weapon) => {
        player.extraLight.set(16);
    },
    [ActionIndex.A_Light2]: (time, player, weapon) => {
        // really?? light up every sector everywhere?
        player.extraLight.set(32);
    },
    [ActionIndex.A_GunFlash]: (time, player, weapon) => {
        player.setState(StateIndex.S_PLAY_ATK2);
        weapon.flash();
    },
    [ActionIndex.A_Lower]: (time, player, weapon) => {
        weapon.position.update(pos => {
            pos.y -= 6;
            if (pos.y < weaponBottom) {
                pos.y = weaponBottom;
                player.weapon.set(player.nextWeapon);
                player.nextWeapon = null;
            }
            return pos;
        });
    },
    [ActionIndex.A_Raise]: (time, player, weapon) => {
        weapon.position.update(pos => {
            pos.y += 6;
            if (pos.y > weaponTop) {
                pos.y = weaponTop;
                weapon.ready();
            }
            return pos;
        });
    },
    [ActionIndex.A_WeaponReady]: (time, player, weapon) => {
        if (player.nextWeapon) {
            // once weapon is down, nextWeapon will be activated
            weapon.deactivate();
            return;
        }

        if (player.attacking) {
            weapon.fire();
        }

        // bob the weapon based on movement speed
        weapon.position.update(pos => {
            let angle = (weaponBobTime * time.elapsed) * HALF_PI;
            pos.x = Math.cos(angle) * player.bob;
            pos.y = weaponTop - (Math.cos(angle * 2 - Math.PI) + 1) * .5 * player.bob;
            return pos;
        });
    },
    [ActionIndex.A_ReFire]: (time, player, weapon) => {
        if (player.attacking) {
            player.refire = true;
            weapon.fire();
        } else {
            player.refire = false;
        }
    },

    [ActionIndex.A_Punch]: (time, player, weapon) => {
        let damage = randInt(1, 11) * 2;
        if (player.inventory.val.items.berserk) {
            damage *= 10;
        }

        let angle = player.direction.val + Math.PI + angleNoise(20);
        const slope = tracer.zAim(player, meleeRange);
        tracer.fire(player, damage, angle, slope, meleeRange);

        // turn to face target
        if (tracer.lastTarget) {
            player.direction.set(angleBetween(player, tracer.lastTarget));
        }
    },
    [ActionIndex.A_Saw]: (time, player, weapon) => {
        let damage = randInt(1, 11) * 2;
        let angle = player.direction.val + Math.PI + angleNoise(20);

        // use meleerange + 1 se the puff doesn't skip the flash
        const slope = tracer.zAim(player, meleeRange + 1);
        tracer.fire(player, damage, angle, slope, meleeRange + 1);

        if (!tracer.lastTarget) {
            // TODO: play sfx_sawful
            return;
        }
        // TODO: play sfx_sawhit

        // turn to face target
        player.direction.update(dir => {
            const newAngle = angleBetween(player, tracer.lastTarget);
            if (newAngle - dir > Math.PI) {
                dir = (newAngle - dir > -HALF_PI / 20)
                    ? newAngle + HALF_PI / 21
                    : dir - HALF_PI / 20;
            } else {
                dir = (newAngle - player.direction.val < HALF_PI / 20)
                    ? newAngle - HALF_PI / 21
                    : dir + HALF_PI / 20;
            }
            return dir;
        });
        // TODO: player think needs to read this to move the player forward
        ///  ... or we could do it another way (like just adjust velocity here toward the target)
        player.info.flags |= MFFlags.MF_JUSTATTACKED;
    },
    [ActionIndex.A_FirePistol]: (time, player, weapon) => {
        weaponActions[ActionIndex.A_GunFlash](time, player, weapon);
        useAmmo(player, weapon);

        const slope = tracer.zAim(player, scanRange);
        let angle = player.direction.val + Math.PI;
        if (player.refire) {
            // mess up angle slightly for refire
            angle += angleNoise(20);
        }
        tracer.fire(player, bulletDamage(), angle, slope, attackRange);
    },
    [ActionIndex.A_FireShotgun]: (time, player, weapon) => {
        weaponActions[ActionIndex.A_GunFlash](time, player, weapon);
        useAmmo(player, weapon);

        const slope = tracer.zAim(player, scanRange);
        const angle = player.direction.val + Math.PI;
        for (let i = 0; i < 7; i++) {
            tracer.fire(player, bulletDamage(), angle + angleNoise(20), slope, attackRange);
        }
    },

    [ActionIndex.A_FireShotgun2]: (time, player, weapon) => {
        // BUG: A_GunFlash goes to flash state but super shotgun has 2 flashes (5 tics and 4 ticks)
        // but we only show the gun frame for 7 so we get an artifact on screen. We can see this bug in
        // chocolate doom but not gzdoom
        weaponActions[ActionIndex.A_GunFlash](time, player, weapon);
        useAmmo(player, weapon);

        const slope = tracer.zAim(player, scanRange);
        let angle = player.direction.val + Math.PI;
        for (let i = 0; i < 20; i++) {
            tracer.fire(player, bulletDamage(), angle + angleNoise(15), slope + angleNoise(30), attackRange);
        }
    },
    [ActionIndex.A_OpenShotgun2]: (time, player, weapon) => {
        // TODO: sound?
    },
    [ActionIndex.A_LoadShotgun2]: (time, player, weapon) => {
        // TODO: sound?
    },
    [ActionIndex.A_CloseShotgun2]: (time, player, weapon) => {
        weaponActions[ActionIndex.A_ReFire](time, player, weapon);
    },

    [ActionIndex.A_FireCGun]: (time, player, weapon) => {
        weapon.flash(weapon.sprite.val.frame);
        player.setState(StateIndex.S_PLAY_ATK2);
        useAmmo(player, weapon);

        const slope = tracer.zAim(player, scanRange);
        let angle = player.direction.val + Math.PI;
        if (player.refire) {
            // mess up angle slightly for refire
            angle += angleNoise(20);
        }
        tracer.fire(player, bulletDamage(), angle, slope, attackRange);
    },

    [ActionIndex.A_FireMissile]: (time, player, weapon) => {
        useAmmo(player, weapon);
        shootMissile(player, MapObjectIndex.MT_ROCKET);
    },

    [ActionIndex.A_FirePlasma]: (time, player, weapon) => {
        weapon.flash(randInt(0, 2));
        // don't go to S_PLAY_ATK2... was that intentional in doom?
        useAmmo(player, weapon);
        shootMissile(player, MapObjectIndex.MT_PLASMA);
    },

    [ActionIndex.A_FireBFG]: (time, player, weapon) => {
        useAmmo(player, weapon);
        shootMissile(player, MapObjectIndex.MT_BFG);
    },
    [ActionIndex.A_BFGSpray]: (time, player, weapon) => {
        // TODO: bfg spray
    },
};

class ShotTracer {
    private _lastTarget: MapObject;
    get lastTarget() { return this._lastTarget; };

    private start = new Vector3();
    private direction = new Vector3();
    zAim(shooter: MapObject, range: number) {
        const dir = shooter.direction.val + Math.PI;
        this.start.copy(shooter.position.val);
        this.start.z += shooter.info.height * .5 + 8;
        this.direction.set(
            Math.cos(dir) * range,
            Math.sin(dir) * range,
            0,
        );

        let aim = aimTrace(shooter, this.start.z, range);
        shooter.map.data.trace(this.start, this.direction, aim.fn);
        if (!aim.target) {
            // try aiming slightly left to see if we hit a target
            let dir2 = dir + Math.PI / 40;
            this.direction.x = Math.cos(dir2) * range;
            this.direction.y = Math.sin(dir2) * range;
            aimTrace(shooter, this.start.z, range);
            shooter.map.data.trace(this.start, this.direction, aim.fn);
        }
        if (!aim.target) {
            // try aiming slightly right to see if we hit a target
            let dir2 = dir - Math.PI / 40;
            this.direction.x = Math.cos(dir2) * range;
            this.direction.y = Math.sin(dir2) * range;
            aimTrace(shooter, this.start.z, range);
            shooter.map.data.trace(this.start, this.direction, aim.fn);
        }

        this._lastTarget = aim.target;
        return aim.target ? aim.slope : 0;
    }

    // kind of like PTR_ShootTraverse from p_map.c
    fire(shooter: MapObject, damage: number, angle: number, aimSlope: number, range: number) {
        this.direction.set(
            Math.cos(angle) * range,
            Math.sin(angle) * range,
            0,
        );

        // this scan function is almost the same as the one we use in zAim but it has a few differences:
        // 1) it spawns blood/puffs on impact
        // 2) it spawns nothing on impact with sky
        // 3) it has a longer range
        // 4) it does not impact aimSlope (it relies on it being set)
        // it's useful to have a separate aim and fire function because some weapons (notably the shotgun)
        // aim once and fire several bullets
        shooter.map.data.trace(this.start, this.direction, hit => {
            if ('id' in hit.hit) {
                const mobj = hit.hit;
                if (mobj === shooter) {
                    return true; // can't shoot ourselves
                }
                if (!(mobj.info.flags & MFFlags.MF_SHOOTABLE)) {
                    return true; // not shootable
                }

                const dist = range * hit.fraction;
                let thingSlopeTop = (mobj.position.val.z + mobj.info.height - this.start.z) / dist;
                if (thingSlopeTop < aimSlope) {
                    return true; // shot over thing
                }

                let thingSlopebottom = (mobj.position.val.z - this.start.z) / dist;
                if (thingSlopebottom > aimSlope) {
                    return true; // shot under thing
                }

                const pos = this.bulletHitLocation(10, hit.fraction, aimSlope, range);
                if (mobj.info.flags & MFFlags.MF_NOBLOOD) {
                    this.spawn(mobj, pos, MapObjectIndex.MT_PUFF);
                } else {
                    this.spawnBlood(mobj, pos, damage);
                }
                mobj.damage(damage, shooter, shooter);
                return false;
            } else if ('flags' in hit.hit) {
                const linedef = hit.hit;
                if (linedef.special) {
                    shooter.map.triggerSpecial(linedef, shooter, 'G', hit.side);
                }

                if (linedef.flags & 0x004) {
                    const front = hit.side === -1 ? linedef.right : linedef.left;
                    const back = hit.side === -1 ? linedef.left : linedef.right;

                    const openTop = Math.min(front.sector.zCeil.val, back.sector.zCeil.val);
                    const openBottom = Math.max(front.sector.zFloor.val, back.sector.zFloor.val);

                    const dist = range * hit.fraction;
                    if (front.sector.zCeil.val !== back.sector.zCeil.val) {
                        const slope = (openTop - this.start.z) / dist;
                        if (slope < aimSlope) {
                            return this.hitWallOrSky(shooter, linedef, this.bulletHitLocation(4, hit.fraction, aimSlope, range));
                        }
                    }
                    if (front.sector.zFloor.val !== back.sector.zFloor.val) {
                        const slope = (openBottom - this.start.z) / dist;
                        if (slope > aimSlope) {
                            return this.hitWallOrSky(shooter, linedef, this.bulletHitLocation(4, hit.fraction, aimSlope, range));
                        }
                    }
                } else {
                    return this.hitWallOrSky(shooter, linedef, this.bulletHitLocation(4, hit.fraction, aimSlope, range));
                }
            } else {
                // sector?
            }
            return true;
        });
    }

    private hitWallOrSky(shooter: MapObject, linedef: LineDef, spot: Vector3) {
        if (linedef.right.sector.ceilFlat.val === 'F_SKY1') {
            if (spot.z > linedef.right.sector.zCeil.val) {
                return false;
            }
            if (linedef.left && linedef.left.sector.ceilFlat.val === 'F_SKY1') {
                return false;
            }
        }
        this.spawn(shooter, spot, MapObjectIndex.MT_PUFF);
        return false;
    }

    // TODO: too many params (and fire() too...), can we refactors these functions a little cleaner?
    private hitLocation = new Vector3();
    private bulletHitLocation(dist: number, frac: number, slope: number, range: number) {
        // position the hit location little bit in front of the actual impact
        frac = frac - dist / range;
        return this.hitLocation.set(
            frac * this.direction.x + this.start.x,
            frac * this.direction.y + this.start.y,
            frac * range * slope + this.start.z,
        )
    }

    private spawn(source: MapObject, position: Vector3, type: MapObjectIndex) {
        const mobj = new MapObject(
            source.map, { type: 0, angle: 0, flags: 0, ...position }, mapObjectInfo[type]);
        return source.map.spawn(mobj);
    }

    private spawnBlood(source: MapObject, position: Vector3, damage: number) {
        position.z += randInt(0, 10) - randInt(0, 10);
        const mobj = this.spawn(source, position, MapObjectIndex.MT_BLOOD);
        mobj.setState(mobj.info.spawnstate, -randInt(0, 3));

        if (damage <= 12 && damage >= 9) {
            mobj.setState(StateIndex.S_BLOOD2);
        } else if (damage < 9) {
            mobj.setState(StateIndex.S_BLOOD3);
        }
    }
}
const tracer = new ShotTracer();

interface AimTrace {
    target: MapObject;
    slope: number;
    fn: HandleTraceHit;
}

// kind of like PTR_AimTraverse from p_map.c
function aimTrace(shooter: MapObject, shootZ: number, range: number): AimTrace {
    // TODO: should these depend on FOV or aspect ratio?
    let slopeTop = 100 / 160;
    let slopeBottom = -100 / 160;
    // TODO: avoid object allocation?
    let result: AimTrace = {
        target: null,
        slope: 0,
        fn: hit => {
            if ('id' in hit.hit) {
                const mobj = hit.hit;
                if (mobj === shooter) {
                    return true; // can't shoot ourselves
                }
                if (!(mobj.info.flags & MFFlags.MF_SHOOTABLE)) {
                    return true; // not shootable
                }

                const dist = range * hit.fraction;
                let thingSlopeTop = (mobj.position.val.z + mobj.info.height - shootZ) / dist;
                if (thingSlopeTop < slopeBottom) {
                    return true; // shot over thing
                }

                let thingSlopebottom = (mobj.position.val.z - shootZ) / dist;
                if (thingSlopebottom > slopeTop) {
                    return true; // shot under thing
                }

                thingSlopeTop = Math.min(thingSlopeTop, slopeTop);
                thingSlopebottom = Math.max(thingSlopebottom, slopeBottom);
                result.slope = (thingSlopeTop + thingSlopebottom) * .5;
                result.target = mobj;
                return false;
            } else if ('flags' in hit.hit) {
                const linedef = hit.hit;
                if (linedef.flags & 0x004) {
                    const front = hit.side === -1 ? linedef.right : linedef.left;
                    const back = hit.side === -1 ? linedef.left : linedef.right;

                    const openTop = Math.min(front.sector.zCeil.val, back.sector.zCeil.val);
                    const openBottom = Math.max(front.sector.zFloor.val, back.sector.zFloor.val);
                    if (openBottom >= openTop) {
                        // it's a two-sided line but there is no opening (eg. a closed door or a raised platform)
                        return false;
                    }

                    const dist = range * hit.fraction;
                    if (front.sector.zCeil.val !== back.sector.zCeil.val) {
                        slopeTop = Math.min(slopeTop, (openTop - shootZ) / dist);
                    }
                    if (front.sector.zFloor.val !== back.sector.zFloor.val) {
                        slopeBottom = Math.max(slopeBottom, (openBottom - shootZ) / dist);
                    }

                    if (slopeTop <= slopeBottom) {
                         // we've run out of gap between top and bottom of walls
                        return false;
                    }
                } else {
                    return false; // single-sided linedefs always stop trace
                }
            } else {
                // sector?
            }
            return true;
        },
    };
    return result;
}

function shootMissile(player: MapObject, type: MapObjectIndex.MT_PLASMA | MapObjectIndex.MT_ROCKET | MapObjectIndex.MT_BFG) {
    const slope = tracer.zAim(player, scanRange);

    let angle = player.direction.val + Math.PI;
    const pos = player.position.val;
    const mobj = player.map.spawn(new MapObject(
        player.map,
        { type: 0, angle: angle * ToDegrees, flags: 0, x: pos.x, y: pos.y, z: pos.z + 32 },
        mapObjectInfo[type]));

    if (mobj.info.seesound) {
        // SOUND: mobj.infoseesound
    }

    // this is kind of an abuse of "chaseTarget" but missles won't ever change anyone anyway. It's used when a missile
    // hits a target to know who fired it.
    mobj.chaseTarget = player;
    mobj.velocity.set(
        mobj.info.speed * Math.cos(angle),
        mobj.info.speed * Math.sin(angle),
        mobj.info.speed * slope,
    );
}

function useAmmo(player: PlayerMapObject, weapon: PlayerWeapon) {
    player.inventory.update(inv => {
        inv.ammo[weapon.ammoType].amount = Math.max(inv.ammo[weapon.ammoType].amount - weapon.ammoPerShot, 0);
        return inv;
    });
}