import { Vector2, Vector3 } from "three";
import type { ThingType } from ".";
import { ActionIndex, MFFlags, MapObjectIndex, StateIndex, mapObjectInfo } from "../doom-things-info";
import { store } from "../store";
import { HALF_PI, randInt } from '../math';
import { type PlayerMapObject, type PlayerInventory, MapObject } from '../map-object';
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
        // TODO: damage infront and spawn puff/blood
    },
    [ActionIndex.A_Saw]: (time, player, weapon) => {
        // TODO: damage in front and look at target (if there is one) and spawn puff/blood
    },
    [ActionIndex.A_FirePistol]: (time, player, weapon) => {
        weaponActions[ActionIndex.A_GunFlash](time, player, weapon);
        useAmmo(player, weapon);

        tracer.zAim(player);
        let angle = player.direction.val + Math.PI;
        if (player.refire) {
            // mess up angle slightly for refire
            angle += (Math.random() - Math.random()) * (Math.PI / 30);
        }
        const damage = 5 * randInt(1, 4);
        tracer.fire(player, angle, damage);
    },
    [ActionIndex.A_FireShotgun]: (time, player, weapon) => {
        weaponActions[ActionIndex.A_GunFlash](time, player, weapon);
        useAmmo(player, weapon);

        // TODO: shoot 7 bullets
    },

    [ActionIndex.A_FireShotgun2]: (time, player, weapon) => {
        // BUG: A_GunFlash goes to flash state but super shotgun has 2 flashes (5 tics and 4 ticks)
        // but we only show the gun frame for 7 so we get an artifact on screen. We can see this bug in
        // chocolate doom but not gzdoom
        weaponActions[ActionIndex.A_GunFlash](time, player, weapon);
        useAmmo(player, weapon);

        // TODO: shoot 20 bullets
    },
    [ActionIndex.A_OpenShotgun2]: (time, player, weapon) => {
    },
    [ActionIndex.A_LoadShotgun2]: (time, player, weapon) => {
    },
    [ActionIndex.A_CloseShotgun2]: (time, player, weapon) => {
        weaponActions[ActionIndex.A_ReFire](time, player, weapon);
    },

    [ActionIndex.A_FireCGun]: (time, player, weapon) => {
        weapon.flash(weapon.sprite.val.frame);
        player.setState(StateIndex.S_PLAY_ATK2);
        useAmmo(player, weapon);

        // TODO: shoot bullet
    },
    [ActionIndex.A_FireMissile]: (time, player, weapon) => {
        useAmmo(player, weapon);

        // TODO: shoot bullet
    },
    [ActionIndex.A_FirePlasma]: (time, player, weapon) => {
        weapon.flash(randInt(0, 2));
        // don't go to S_PLAY_ATK2... was that intentional in doom?
        useAmmo(player, weapon);

        // TODO: shoot bullet
    },
    [ActionIndex.A_FireBFG]: (time, player, weapon) => {
        useAmmo(player, weapon);

        // TODO: shoot bullet
    },
};

class ShotTracer {
    constructor(
        readonly scanRange = 16 * 64,
        readonly attackRange = 32 * 64,
    ) {}

    private start = new Vector3();
    private direction = new Vector3();
    private aimSlope = 0;
    zAim(shooter: MapObject) {
        const dir = shooter.direction.val + Math.PI;
        this.start.copy(shooter.position.val);
        this.start.z += shooter.info.height * .5 + 8;
        this.direction.set(
            Math.cos(dir) * this.scanRange,
            Math.sin(dir) * this.scanRange,
            0,
        );

        let aim = aimTrace(shooter, this.start.z, this.scanRange);
        shooter.map.data.trace(this.start, this.direction, aim.fn);
        if (!aim.target) {
            // try aiming slightly left to see if we hit a target
            let dir2 = dir + Math.PI / 40;
            this.direction.x = Math.cos(dir2) * this.scanRange;
            this.direction.y = Math.sin(dir2) * this.scanRange;
            aimTrace(shooter, this.start.z, this.scanRange);
            shooter.map.data.trace(this.start, this.direction, aim.fn);
        }
        if (!aim.target) {
            // try aiming slightly right to see if we hit a target
            let dir2 = dir - Math.PI / 40;
            this.direction.x = Math.cos(dir2) * this.scanRange;
            this.direction.y = Math.sin(dir2) * this.scanRange;
            aimTrace(shooter, this.start.z, this.scanRange);
            shooter.map.data.trace(this.start, this.direction, aim.fn);
        }

        this.aimSlope = 0;
        if (aim.target) {
            this.aimSlope = aim.slope;
        }
    }

    // kind of like PTR_ShootTraverse from p_map.c
    fire(shooter: MapObject, angle: number, damage: number) {
        this.direction.set(
            Math.cos(angle) * this.attackRange,
            Math.sin(angle) * this.attackRange,
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

                const dist = this.attackRange * hit.fraction;
                let thingSlopeTop = (mobj.position.val.z + mobj.info.height - this.start.z) / dist;
                if (thingSlopeTop < this.aimSlope) {
                    return true; // shot over thing
                }

                let thingSlopebottom = (mobj.position.val.z - this.start.z) / dist;
                if (thingSlopebottom > this.aimSlope) {
                    return true; // shot under thing
                }

                if (mobj.info.flags & MFFlags.MF_NOBLOOD) {
                    this.spawn(mobj, this.bulletHitLocation(10, hit.fraction), MapObjectIndex.MT_PUFF);
                } else {
                    this.spawnBlood(mobj, this.bulletHitLocation(10, hit.fraction), damage);
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

                    const dist = this.attackRange * hit.fraction;
                    if (front.sector.zCeil.val !== back.sector.zCeil.val) {
                        const slope = (openTop - this.start.z) / dist;
                        if (slope < this.aimSlope) {
                            return this.hitWallOrSky(shooter, linedef, hit.fraction);
                        }
                    }
                    if (front.sector.zFloor.val !== back.sector.zFloor.val) {
                        const slope = (openBottom - this.start.z) / dist;
                        if (slope > this.aimSlope) {
                            return this.hitWallOrSky(shooter, linedef, hit.fraction);
                        }
                    }
                } else {
                    return this.hitWallOrSky(shooter, linedef, hit.fraction);
                }
            } else {
                // sector?
            }
            return true;
        });
    }

    private hitWallOrSky(shooter: MapObject, linedef: LineDef, frac: number) {
        const spot = this.bulletHitLocation(4, frac);
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

    private hitLocation = new Vector3();
    private bulletHitLocation(dist: number, frac: number) {
        // position the hit location little bit in front of the actual impact
        frac = frac - dist / this.attackRange;
        return this.hitLocation.set(
            frac * this.direction.x + this.start.x,
            frac * this.direction.y + this.start.y,
            frac * this.attackRange * this.aimSlope + this.start.z,
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
        // TODO: subtrac 0-2 sprite tics for aesthetics

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

function useAmmo(player: PlayerMapObject, weapon: PlayerWeapon) {
    player.inventory.update(inv => {
        inv.ammo[weapon.ammoType].amount = Math.max(inv.ammo[weapon.ammoType].amount - weapon.ammoPerShot, 0);
        return inv;
    });
}