import { Euler, Vector2, Vector3 } from "three";
import type { ThingType } from ".";
import { ActionIndex, MFFlags, MapObjectIndex, SoundIndex, StateIndex } from "../doom-things-info";
import { store } from "../store";
import { HALF_PI, QUARTER_PI, angleNoise, randInt } from '../math';
import { PlayerMapObject, type PlayerInventory, MapObject, angleBetween } from '../map-object';
import { SpriteStateMachine } from '../sprite';
import { giveAmmo } from "./ammunitions";
import { ticksPerSecond, type GameTime } from "../game";
import { hitSkyFlat, type HandleTraceHit, type Sector, hitSkyWall } from "../map-data";
import { itemPickedUp, noPickUp } from "./pickup";
import type { MessageId } from "../text";
import { propagateSound } from "./monsters";

export const weaponTop = 32;
const weaponBottom = 32 - 128;

type WeaponName =
    'chainsaw' | 'fist' | 'pistol' | 'super shotgun' | 'shotgun' | 'chaingun' | 'rocket launcher' | 'plasma rifle' | 'bfg';
export interface InventoryWeapon {
    keynum: number;
    name: WeaponName;
    pickupMessage?: MessageId;
    fn: () => PlayerWeapon;
}

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
        readonly name: WeaponName,
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
        this.player.refire = false;
        this._sprite.setState(this.upState);

        if (this.name === 'chainsaw') {
            player.map.game.playSound(SoundIndex.sfx_sawup, player);
        }
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
            propagateSound(this.player);
        } else {
            chooseNewWeapon(this.player)
        }
    }
}

export const allWeapons: InventoryWeapon[] = [
    {
        name: 'fist',
        keynum: 1,
        fn: () => new PlayerWeapon('fist', 'none', 0, StateIndex.S_PUNCHUP, StateIndex.S_PUNCHDOWN, StateIndex.S_PUNCH, StateIndex.S_PUNCH1, StateIndex.S_NULL),
    },
    {
        name: 'chainsaw',
        keynum: 1,
        pickupMessage: 'GOTCHAINSAW',
        fn: () => new PlayerWeapon('chainsaw', 'none', 0, StateIndex.S_SAWUP, StateIndex.S_SAWDOWN, StateIndex.S_SAW, StateIndex.S_SAW1, StateIndex.S_NULL),
    },
    {
        name: 'pistol',
        keynum: 2,
        fn: () => new PlayerWeapon('pistol', 'bullets', 1, StateIndex.S_PISTOLUP, StateIndex.S_PISTOLDOWN, StateIndex.S_PISTOL, StateIndex.S_PISTOL1, StateIndex.S_PISTOLFLASH),
    },
    {
        name: 'shotgun',
        keynum: 3,
        pickupMessage: 'GOTSHOTGUN',
        fn: () => new PlayerWeapon('shotgun', 'shells', 1, StateIndex.S_SGUNUP, StateIndex.S_SGUNDOWN, StateIndex.S_SGUN, StateIndex.S_SGUN1, StateIndex.S_SGUNFLASH1),
    },
    {
        name: 'super shotgun',
        keynum: 3,
        pickupMessage: 'GOTSHOTGUN2',
        fn: () => new PlayerWeapon('super shotgun', 'shells', 2, StateIndex.S_DSGUNUP, StateIndex.S_DSGUNDOWN, StateIndex.S_DSGUN, StateIndex.S_DSGUN1, StateIndex.S_DSGUNFLASH1),
    },
    {
        name: 'chaingun',
        keynum: 4,
        pickupMessage: 'GOTCHAINGUN',
        fn: () => new PlayerWeapon('chaingun', 'bullets', 1, StateIndex.S_CHAINUP, StateIndex.S_CHAINDOWN, StateIndex.S_CHAIN, StateIndex.S_CHAIN1, StateIndex.S_CHAINFLASH1),
    },
    {
        name: 'rocket launcher',
        keynum: 5,
        pickupMessage: 'GOTLAUNCHER',
        fn: () => new PlayerWeapon('rocket launcher', 'rockets', 1, StateIndex.S_MISSILEUP, StateIndex.S_MISSILEDOWN, StateIndex.S_MISSILE, StateIndex.S_MISSILE1, StateIndex.S_MISSILEFLASH1),
    },
    {
        name: 'plasma rifle',
        keynum: 6,
        pickupMessage: 'GOTPLASMA',
        fn: () => new PlayerWeapon('plasma rifle', 'cells', 1, StateIndex.S_PLASMAUP, StateIndex.S_PLASMADOWN, StateIndex.S_PLASMA, StateIndex.S_PLASMA1, StateIndex.S_PLASMAFLASH1),
    },
    {
        name: 'bfg',
        keynum: 7,
        pickupMessage: 'GOTBFG9000',
        fn: () => new PlayerWeapon('bfg', 'cells', 40, StateIndex.S_BFGUP, StateIndex.S_BFGDOWN, StateIndex.S_BFG, StateIndex.S_BFG1, StateIndex.S_BFGFLASH1),
    },
];
export const inventoryWeapon = (name: WeaponName) => allWeapons.find(e => e.name === name);

export const weaponItems: ThingType[] = [
    { type: 82, class: 'W', description: 'Super shotgun', onPickup: giveWeapon('super shotgun') },
    { type: 2001, class: 'W', description: 'Shotgun', onPickup: giveWeapon('shotgun') },
    { type: 2002, class: 'W', description: 'Chaingun', onPickup: giveWeapon('chaingun') },
    { type: 2003, class: 'W', description: 'Rocket launcher', onPickup: giveWeapon('rocket launcher') },
    { type: 2004, class: 'W', description: 'Plasma gun', onPickup: giveWeapon('plasma rifle') },
    { type: 2005, class: 'W', description: 'Chainsaw', onPickup: giveWeapon('chainsaw') },
    { type: 2006, class: 'W', description: 'BFG9000', onPickup: giveWeapon('bfg') },
];

function giveWeapon(name: WeaponName) {
    const factory = inventoryWeapon(name);
    const weapon = factory.fn();
    return (player: PlayerMapObject, mobj: MapObject) => {
        let pickedup = false;
        player.inventory.update(inv => {
            if (weapon.ammoType !== 'none') {
                // only give 1 clip for droped weapon
                const clipCount = (mobj.info.flags & MFFlags.MF_DROPPED) ? 1 : 2;
                pickedup = giveAmmo(player, inv, weapon.ammoType, clipCount);
            }
            const wIndex = Object.values(allWeapons).indexOf(factory);
            if (!inv.weapons[wIndex]) {
                pickedup = true;
                // keep weapons in the same order as the above weapons list so select works properly
                // (ie. select chainsaw before fist if we have a chainsaw)
                inv.weapons[wIndex] = factory;
                player.nextWeapon = factory;
            }
            return inv;
        });
        return pickedup
            ? itemPickedUp(SoundIndex.sfx_wpnup, factory.pickupMessage, player.map.game.mode === 'solo')
            : noPickUp();
    }
}

function chooseNewWeapon(player: PlayerMapObject) {
    const ammo = player.inventory.val.ammo;
    const [ chainsaw, fist, pistol, superShotgun, shotgun, chaingun, rocketLauncher, plasma, bfg ] = player.inventory.val.weapons;
    player.nextWeapon =
        (plasma && ammo.cells.amount) ? plasma :
        (superShotgun && ammo.shells.amount >= superShotgun.fn().ammoPerShot) ? superShotgun :
        (chaingun && ammo.bullets.amount) ? chaingun :
        (shotgun && ammo.shells.amount) ? shotgun :
        (pistol && ammo.bullets.amount) ? pistol :
        (chainsaw) ? chainsaw :
        (rocketLauncher && ammo.rockets.amount) ? rocketLauncher :
        (bfg && ammo.cells.amount >= bfg.fn().ammoPerShot) ? bfg :
        fist; // good ol' rock, nothing beats that!
}

export const meleeRange = 1 * 64;
export const scanRange = 16 * 64;
export const attackRange = 32 * 64;
const bulletDamage = () => 5 * randInt(1, 3);

const weaponBobTime = 128 / ticksPerSecond;
// TODO: I'd actually like to remove these from ActionIndex and instead make them completely local to weapon.ts
// I'd like to do the same thing with StateIndex (move all weapon states to this file so that all weapon related stuff
// is isolated from other things). Long term, we could also move enemy and other bits to their own files too so that
// all the declarations for a type of "thing" are in a single place. Something to aspire to.
type WeaponAction = (time: GameTime, player: PlayerMapObject, weapon: PlayerWeapon) => void
export const weaponActions: { [key: number]: WeaponAction } = {
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
            if (player.isDead) {
                pos.y = weaponBottom;
                return pos;
            }

            pos.y -= 6;
            if (pos.y < weaponBottom) {
                pos.y = weaponBottom;
                player.weapon.set(player.nextWeapon.fn());
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

        // if (player.weapon.val.name === 'chainsaw' && psp->state == &states[S_SAW]) {
        //     player.map.game.playSound(SoundIndex.sfx_sawidl, player);
        // }

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
        let damage = randInt(1, 10) * 2;
        if (player.inventory.val.items.berserk) {
            damage *= 10;
        }

        let angle = player.direction.val + angleNoise(20);
        const slope = shotTracer.zAim(player, meleeRange);
        shotTracer.fire(player, damage, angle, slope, meleeRange);

        // turn to face target
        if (shotTracer.lastTarget) {
            player.map.game.playSound(SoundIndex.sfx_punch, player);
            player.direction.set(angleBetween(player, shotTracer.lastTarget));
        }
    },
    [ActionIndex.A_Saw]: (time, player, weapon) => {
        let damage = randInt(1, 10) * 2;
        let angle = player.direction.val + angleNoise(20);

        // use meleerange + 1 so the puff doesn't skip the flash
        const slope = shotTracer.zAim(player, meleeRange + 1);
        shotTracer.fire(player, damage, angle, slope, meleeRange + 1);

        if (!shotTracer.lastTarget) {
            player.map.game.playSound(SoundIndex.sfx_sawful, player);
            return;
        }
        player.map.game.playSound(SoundIndex.sfx_sawhit, player);

        // turn to face target
        player.direction.update(dir => {
            const newAngle = angleBetween(player, shotTracer.lastTarget);
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
        player.map.game.playSound(SoundIndex.sfx_pistol, player);

        const slope = shotTracer.zAim(player, scanRange);
        let angle = player.direction.val;
        if (player.refire) {
            // mess up angle slightly for refire
            angle += angleNoise(20);
        }
        shotTracer.fire(player, bulletDamage(), angle, slope, attackRange);
    },
    [ActionIndex.A_FireShotgun]: (time, player, weapon) => {
        weaponActions[ActionIndex.A_GunFlash](time, player, weapon);
        useAmmo(player, weapon);
        player.map.game.playSound(SoundIndex.sfx_shotgn, player);

        const slope = shotTracer.zAim(player, scanRange);
        const angle = player.direction.val;
        for (let i = 0; i < 7; i++) {
            shotTracer.fire(player, bulletDamage(), angle + angleNoise(20), slope, attackRange);
        }
    },

    [ActionIndex.A_FireShotgun2]: (time, player, weapon) => {
        // BUG: A_GunFlash goes to flash state but super shotgun has 2 flashes (5 tics and 4 ticks)
        // but we only show the gun frame for 7 so we get an artifact on screen. We can see this bug in
        // chocolate doom but not gzdoom
        weaponActions[ActionIndex.A_GunFlash](time, player, weapon);
        useAmmo(player, weapon);
        player.map.game.playSound(SoundIndex.sfx_dshtgn, player);

        const slope = shotTracer.zAim(player, scanRange);
        let angle = player.direction.val;
        for (let i = 0; i < 20; i++) {
            shotTracer.fire(player, bulletDamage(), angle + angleNoise(15), slope + angleNoise(30), attackRange);
        }
    },
    [ActionIndex.A_OpenShotgun2]: (time, player, weapon) => {
        player.map.game.playSound(SoundIndex.sfx_dbopn, player)
    },
    [ActionIndex.A_LoadShotgun2]: (time, player, weapon) => {
        player.map.game.playSound(SoundIndex.sfx_dbload, player)
    },
    [ActionIndex.A_CloseShotgun2]: (time, player, weapon) => {
        player.map.game.playSound(SoundIndex.sfx_dbcls, player)
        weaponActions[ActionIndex.A_ReFire](time, player, weapon);
    },

    [ActionIndex.A_FireCGun]: (time, player, weapon) => {
        weapon.flash(weapon.sprite.val.frame);
        player.setState(StateIndex.S_PLAY_ATK2);
        useAmmo(player, weapon);
        player.map.game.playSound(SoundIndex.sfx_pistol, player);

        const slope = shotTracer.zAim(player, scanRange);
        let angle = player.direction.val;
        if (player.refire) {
            // mess up angle slightly for refire
            angle += angleNoise(20);
        }
        shotTracer.fire(player, bulletDamage(), angle, slope, attackRange);
    },

    [ActionIndex.A_FireMissile]: (time, player, weapon) => {
        useAmmo(player, weapon);
        shootMissile(player, MapObjectIndex.MT_ROCKET);
    },

    [ActionIndex.A_FirePlasma]: (time, player, weapon) => {
        weapon.flash(randInt(0, 1));
        // don't go to S_PLAY_ATK2... was that intentional in doom?
        useAmmo(player, weapon);
        shootMissile(player, MapObjectIndex.MT_PLASMA);
    },

    [ActionIndex.A_BFGsound]: (time, player, weapon) => {
        player.map.game.playSound(SoundIndex.sfx_bfg, player);
    },
    [ActionIndex.A_FireBFG]: (time, player, weapon) => {
        useAmmo(player, weapon);
        shootMissile(player, MapObjectIndex.MT_BFG);
    },

    // This isn't really a "weapon" thing (the BFG spray comes frmm the missile) but because the trace is so
    // similar to firing a weapon, I'm leaving it here for now.
    [ActionIndex.A_BFGSpray]: (time, mobj, weapon) => {
        // shooter is the chaseTarget who fired this missile
        const tDir = new Vector3();
        const shooter = mobj.chaseTarget;
        const dir = mobj.direction.val;
        const aim = aimTrace(shooter, mobj.position.val.z, scanRange);
        for (let i = 0; i < 40; i++) {
            let angle = dir - QUARTER_PI + HALF_PI / 40 * i;

            // scan from the direction of the _missile_ but the position of the _shooter_ (!)
            // https://doomwiki.org/wiki/BFG9000
            tDir.set(
                Math.cos(angle) * scanRange,
                Math.sin(angle) * scanRange,
                0);
            aim.target = null; // must clear before running the trace otherwise we could get stale data
            mobj.map.data.traceRay(shooter.position.val, tDir, aim.fn);
            if (!aim.target) {
                continue;
            }

            const pos = aim.target.position.val;
            mobj.map.spawn(MapObjectIndex.MT_EXTRABFG, pos.x, pos.y, pos.z + aim.target.info.height * .5);

            let damage = 0;
            for (let j = 0; j < 15; j++) {
                damage += randInt(1, 8);
            }
            aim.target.damage(damage, shooter, shooter);
        }
    },
};

const _shotEuler = new Euler(0, 0, 0, 'ZXY');
class ShotTracer {
    private _lastTarget: MapObject;
    get lastTarget() { return this._lastTarget; };

    private start = new Vector3();
    private direction = new Vector3();
    zAim(shooter: MapObject | PlayerMapObject, range: number) {
        this.start.copy(shooter.position.val);
        this.start.z += shooter.info.height * .5 + 8;
        const dir = shooter.direction.val;
        this.direction.set(
            Math.cos(dir) * range,
            Math.sin(dir) * range,
            0);

        let aim = aimTrace(shooter, this.start.z, range);
        shooter.map.data.traceRay(this.start, this.direction, aim.fn);
        if (!aim.target) {
            // try aiming slightly left to see if we hit a target
            let dir2 = dir + Math.PI / 40;
            this.direction.x = Math.cos(dir2) * range;
            this.direction.y = Math.sin(dir2) * range;
            aimTrace(shooter, this.start.z, range);
            shooter.map.data.traceRay(this.start, this.direction, aim.fn);
        }
        if (!aim.target) {
            // try aiming slightly right to see if we hit a target
            let dir2 = dir - Math.PI / 40;
            this.direction.x = Math.cos(dir2) * range;
            this.direction.y = Math.sin(dir2) * range;
            aimTrace(shooter, this.start.z, range);
            shooter.map.data.traceRay(this.start, this.direction, aim.fn);
        }

        this._lastTarget = aim.target;
        if (shooter instanceof PlayerMapObject && !shooter.map.game.settings.zAimAssist.val) {
            // ignore all the tracing we did (except set last target for puch/saw) and simply use the camera angle
            return Math.sin(shooter.pitch.val);
        }
        // TODO: we convert angle to slope (and later undo this), why not just use angles?
        return aim.target ? aim.slope : 0;
    }

    // kind of like PTR_ShootTraverse from p_map.c
    fire(shooter: MapObject, damage: number, angle: number, aimSlope: number, range: number) {
        // this scan function is almost the same as the one we use in zAim but it has a few differences:
        // 1) it spawns blood/puffs on impact
        // 2) it spawns nothing on impact with sky
        // 3) it has a longer range
        // 4) it does not impact aimSlope (it relies on it being set)
        // it's useful to have a separate aim and fire function because some weapons (notably the shotgun)
        // aim once and fire several bullets
        _shotEuler.set(0, Math.acos(aimSlope) - HALF_PI, angle);
        this.direction.set(range, 0, 0).applyEuler(_shotEuler);

        shooter.map.data.traceRay(this.start, this.direction, hit => {
            const hitZ = this.direction.z * hit.fraction + this.start.z;
            if ('mobj' in hit) {
                const ignoreHit = (false
                    || (hit.mobj === shooter) // can't shoot ourselves
                    || !(hit.mobj.info.flags & MFFlags.MF_SHOOTABLE) // not shootable
                    || (hit.mobj.position.val.z + hit.mobj.info.height < hitZ) // shoot over thing
                    || (hit.mobj.position.val.z > hitZ) // shoot over thing
                )
                if (ignoreHit) {
                    return true; // keep searching
                }

                const pos = this.bulletHitLocation(10, range, hit.fraction);
                if (hit.mobj.info.flags & MFFlags.MF_NOBLOOD) {
                    spawnPuff(shooter, pos);
                } else {
                    this.spawnBlood(hit.mobj, pos, damage);
                }
                hit.mobj.damage(damage, shooter, shooter);
                return false;
            } else if ('line' in hit) {
                if (hit.line.special) {
                    shooter.map.triggerSpecial(hit.line, shooter, 'G', hit.side);
                }

                if (!hit.line.left) {
                    return this.hitWallOrSky(shooter, hit.line.right.sector, null, this.bulletHitLocation(4, range, hit.fraction));
                }

                const front = (hit.side === -1 ? hit.line.right : hit.line.left).sector;
                const back = (hit.side === -1 ? hit.line.left : hit.line.right).sector;
                if (front.zCeil.val !== back.zCeil.val) {
                    const wallBottom = Math.min(front.zCeil.val, back.zCeil.val);
                    if (wallBottom < hitZ) {
                        return this.hitWallOrSky(shooter, front, back, this.bulletHitLocation(4, range, hit.fraction));
                    }
                }
                if (front.zFloor.val !== back.zFloor.val) {
                    const wallTop = Math.max(front.zFloor.val, back.zFloor.val);
                    if (wallTop > hitZ) {
                        return this.hitWallOrSky(shooter, front, back, this.bulletHitLocation(4, range, hit.fraction));
                    }
                }
            } else if ('flat' in hit) {
                if (hitSkyFlat(hit)) {
                    return false; // hit sky so don't spawn puff and don't keep searching, we're done.
                }
                const mobj = spawnPuff(shooter, this.bulletHitLocation(4, range, hit.fraction));
                if (hit.flat === 'ceil') {
                    // invert puff sprite when hitting ceiling
                    mobj.info.flags |= MFFlags.InvertSpriteYOffset;
                }
                return false;
            }
            return true;
        });
    }

    private hitWallOrSky(shooter: MapObject, front: Sector, back: Sector, spot: Vector3) {
        if (hitSkyWall(spot.z, front, back)) {
            return false;
        }
        spawnPuff(shooter, spot);
    }

    private hitLocation = new Vector3();
    private bulletHitLocation(dist: number, range: number, frac: number) {
        return this.hitLocation.copy(this.start)
            // position the hit location little bit in front of the actual impact
            .addScaledVector(this.direction, frac - dist / range);
    }

    private spawnBlood(source: MapObject, pos: Vector3, damage: number) {
        const mobj = source.map.spawn(MapObjectIndex.MT_BLOOD, pos.x, pos.y, pos.z + randInt(-9, 9));
        mobj.setState(mobj.info.spawnstate, -randInt(0, 2));

        if (damage <= 12 && damage >= 9) {
            mobj.setState(StateIndex.S_BLOOD2);
        } else if (damage < 9) {
            mobj.setState(StateIndex.S_BLOOD3);
        }
    }
}
export const shotTracer = new ShotTracer();

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
            if ('mobj' in hit) {
                if (hit.mobj === shooter) {
                    return true; // can't shoot ourselves
                }
                if (!(hit.mobj.info.flags & MFFlags.MF_SHOOTABLE)) {
                    return true; // not shootable
                }

                const dist = range * hit.fraction;
                let thingSlopeTop = (hit.mobj.position.val.z + hit.mobj.info.height - shootZ) / dist;
                if (thingSlopeTop < slopeBottom) {
                    return true; // shoot over
                }

                let thingSlopeBottom = (hit.mobj.position.val.z - shootZ) / dist;
                if (thingSlopeBottom > slopeTop) {
                    return true; // shoot under
                }

                thingSlopeTop = Math.min(thingSlopeTop, slopeTop);
                thingSlopeBottom = Math.max(thingSlopeBottom, slopeBottom);
                result.slope = (thingSlopeTop + thingSlopeBottom) * .5;
                result.target = hit.mobj;
                return false;
            } else if ('line' in hit) {
                const oneSided = !Boolean(hit.line.left);
                if (oneSided) {
                    return false; // single-sided linedefs always stop trace
                }

                const front = hit.side === -1 ? hit.line.right : hit.line.left;
                const back = hit.side === -1 ? hit.line.left : hit.line.right;
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
                // sector?
            }
            return true;
        },
    };
    return result;
}

type PlayerMissileType = MapObjectIndex.MT_PLASMA | MapObjectIndex.MT_ROCKET | MapObjectIndex.MT_BFG;
function shootMissile(shooter: MapObject, type: PlayerMissileType) {
    const angle = shooter.direction.val;
    const pos = shooter.position.val;
    const missile = shooter.map.spawn(type, pos.x, pos.y, pos.z + 32);
    missile.direction.set(angle);
    missile.map.game.playSound(missile.info.seesound, missile);
    // this is kind of an abuse of "chaseTarget" but missles won't ever chase anyone anyway. It's used when a missile
    // hits a target to know who fired it.
    missile.chaseTarget = shooter;

    const slope = shotTracer.zAim(shooter, scanRange);
    _shotEuler.set(0, Math.acos(slope) - HALF_PI, angle);
    missile.velocity.set(missile.info.speed, 0, 0).applyEuler(_shotEuler);
}

function useAmmo(player: PlayerMapObject, weapon: PlayerWeapon) {
    player.inventory.update(inv => {
        inv.ammo[weapon.ammoType].amount = Math.max(inv.ammo[weapon.ammoType].amount - weapon.ammoPerShot, 0);
        return inv;
    });
}

export function spawnPuff(parent: MapObject, spot: Vector3) {
    const zNoise = randInt(-5, 5) * .5;
    const mobj = parent.map.spawn(MapObjectIndex.MT_PUFF, spot.x, spot.y, spot.z + zNoise);
    mobj.setState(mobj.info.spawnstate, -randInt(0, 2));
    return mobj;
}