import { Vector2, Vector3 } from "three";
import type { ThingType } from ".";
import { ActionIndex, StateIndex } from "../doom-things-info";
import { store } from "../store";
import { HALF_PI, randInt } from '../math';
import type { PlayerMapObject, PlayerInventory } from '../map-object';
import { SpriteStateMachine } from '../sprite';
import { giveAmmo } from "./ammunitions";
import { ticksPerSecond, type GameTime } from "../game";

export const weaponTop = 32;
const weaponBottom = 32 - 128;
const shootDirection = new Vector3();

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

        // TODO: shoot bullet (wip below...)
        // const dir = player.direction.val + Math.PI;
        // let aimZ: number;
        // shootDirection.set(
        //     Math.cos(dir) * 16 * 64,
        //     Math.sin(dir) * 16 * 64,
        //     player.info.height + 8,
        // );
        // player.map.trace(player.position.val, shootDirection, 0,
        //     thing => {
        //         if (thing === player) {
        //             return true; // continue, we can't shoot ourselves
        //         }
        //         if (!(thing.info.flags & MFFlags.MF_SHOOTABLE)) {
        //             return true; // thing is not shootable
        //         }

        //         // hit a thing so stop tracing
        //         // TODO check top/bottom of object and slope of shot has to be in view angle
        //         return false;
        //     },
        //     linedef => {
        //         if (!(linedef.flags & 0x004)) {
        //             // player.map.spawn(new MapObject(player.map, { type: 0, angle: 0, flags: 0, x: pos.x, y: pos.y }, mapObjectInfo[MapObjectIndex.MT_PUFF]));
        //             return false; // single-sided linedefs always stop shots
        //         }
        //         return true;
        //     });
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

function useAmmo(player: PlayerMapObject, weapon: PlayerWeapon) {
    player.inventory.update(inv => {
        inv.ammo[weapon.ammoType].amount = Math.max(inv.ammo[weapon.ammoType].amount - weapon.ammoPerShot, 0);
        return inv;
    });
}