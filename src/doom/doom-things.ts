import { Vector2, Vector3 } from 'three';
import { type MapObject, type PlayerMapObject } from './MapObject';
import { store } from './Store';
import { mapObjectInfo, StateIndex, type MapObjectInfo, type State, states, SpriteNames, ActionIndex } from './doom-things-info';
import {
    FF_FRAMEMASK,
    FF_FULLBRIGHT,
    type AmmoType,
    type PlayerInventory,
    type Sprite,
    type PlayerWeapon as IPlayerWeapon,
    type PlayerMapObject as IPlayerMapObject,
} from './types';
import { randInt } from './Math';

// I don't love having the logic of weapons and pickup here and especially because we've already
// got this data spread doom-things and doom-things-info (and ThingType, MapObject, and MapObjectInfo). I'd really like
// to just put this into one place so if I want to add a new item/weapon/monster I can do that by editing one structure
// rather than 3. Something to improve for later.
export const weaponTop = 32;
const weaponBottom = 32 - 128;
const shootDirection = new Vector3();
type WeaponThink = (player: IPlayerMapObject, weapon: IPlayerWeapon) => void
const weaponActions: { [key: number]: WeaponThink } = {
    [ActionIndex.NULL]: (player, weapon) => {},
    [ActionIndex.A_Light0]: (player, weapon) => {
        player.extraLight.set(0);
    },
    [ActionIndex.A_Light1]: (player, weapon) => {
        player.extraLight.set(16);
    },
    [ActionIndex.A_Light2]: (player, weapon) => {
        // really?? light up every sector everywhere?
        player.extraLight.set(32);
    },
    [ActionIndex.A_GunFlash]: (player, weapon) => {
        player.setState(StateIndex.S_PLAY_ATK2);
        weapon.flash();
    },
    [ActionIndex.A_Lower]: (player, weapon) => {
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
    [ActionIndex.A_Raise]: (player, weapon) => {
        weapon.position.update(pos => {
            pos.y += 6;
            if (pos.y > weaponTop) {
                pos.y = weaponTop;
                weapon.ready();
            }
            return pos;
        });
    },
    [ActionIndex.A_WeaponReady]: (player, weapon) => {
        if (player.nextWeapon) {
            // once weapon is down, nextWeapon will be activated
            weapon.deactivate();
            return;
        }

        if (player.attacking) {
            weapon.fire();
        }
    },
    [ActionIndex.A_ReFire]: (player, weapon) => {
        if (player.attacking) {
            player.refire = true;
            weapon.fire();
        } else {
            player.refire = false;
        }
    },

    [ActionIndex.A_Punch]: (player, weapon) => {
        // TODO: damage infront and spawn puff/blood
    },
    [ActionIndex.A_Saw]: (player, weapon) => {
        // TODO: damage in front and look at target (if there is one) and spawn puff/blood
    },
    [ActionIndex.A_FirePistol]: (player, weapon) => {
        weaponActions[ActionIndex.A_GunFlash](player, weapon);
        player.inventory.update(inv => {
            // inv.ammo[weapon.ammoType].amount = Math.max(inv.ammo[weapon.ammoType].amount - weapon.ammoPerShot, 0);
            return inv;
        });

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
    [ActionIndex.A_FireShotgun]: (player, weapon) => {
        weaponActions[ActionIndex.A_GunFlash](player, weapon);
        player.inventory.update(inv => {
            inv.ammo[weapon.ammoType].amount = Math.max(inv.ammo[weapon.ammoType].amount - weapon.ammoPerShot, 0);
            return inv;
        });

        // TODO: shoot 7 bullets
    },

    [ActionIndex.A_FireShotgun2]: (player, weapon) => {
        // BUG: A_GunFlash goes to flash state but super shotgun has 2 flashes (5 tics and 4 ticks)
        // but we only show the gun frame for 7 so we get an artifact on screen. We can see this bug in
        // chocolate doom but not gzdoom
        weaponActions[ActionIndex.A_GunFlash](player, weapon);
        player.inventory.update(inv => {
            inv.ammo[weapon.ammoType].amount = Math.max(inv.ammo[weapon.ammoType].amount - weapon.ammoPerShot, 0);
            return inv;
        });

        // TODO: shoot 20 bullets
    },
    [ActionIndex.A_OpenShotgun2]: (player, weapon) => {
    },
    [ActionIndex.A_LoadShotgun2]: (player, weapon) => {
    },
    [ActionIndex.A_CloseShotgun2]: (player, weapon) => {
        weaponActions[ActionIndex.A_ReFire](player, weapon);
    },

    [ActionIndex.A_FireCGun]: (player, weapon) => {
        weapon.flash(weapon.sprite.val.frame);
        player.setState(StateIndex.S_PLAY_ATK2);
        player.inventory.update(inv => {
            inv.ammo[weapon.ammoType].amount = Math.max(inv.ammo[weapon.ammoType].amount - weapon.ammoPerShot, 0);
            return inv;
        });

        // TODO: shoot bullet
    },
    [ActionIndex.A_FireMissile]: (player, weapon) => {
        player.inventory.update(inv => {
            inv.ammo[weapon.ammoType].amount = Math.max(inv.ammo[weapon.ammoType].amount - weapon.ammoPerShot, 0);
            return inv;
        });

        // TODO: shoot bullet
    },
    [ActionIndex.A_FirePlasma]: (player, weapon) => {
        weapon.flash(randInt(0, 2));
        // don't go to S_PLAY_ATK2... was that intentional in doom?
        player.inventory.update(inv => {
            inv.ammo[weapon.ammoType].amount = Math.max(inv.ammo[weapon.ammoType].amount - weapon.ammoPerShot, 0);
            return inv;
        });

        // TODO: shoot bullet
    },
    [ActionIndex.A_FireBFG]: (player, weapon) => {
        player.inventory.update(inv => {
            inv.ammo[weapon.ammoType].amount = Math.max(inv.ammo[weapon.ammoType].amount - weapon.ammoPerShot, 0);
            return inv;
        });

        // TODO: shoot bullet
    },
};

export class SpriteStateMachine {
    private ticks: number;
    private stateIndex: StateIndex;
    private state: State;
    readonly sprite = store<Sprite>(null);
    get index() { return this.stateIndex; }

    constructor(private stateAction: (action: ActionIndex) => void) {}

    tick() {
        if (!this.state || this.ticks < 0) {
            return;
        }
        this.ticks -= 1;
        if (this.ticks === 0) {
            this.setState(this.state.nextState);
        }
    }

    setState(stateIndex: StateIndex) {
        const lastState = this.state;
        do {
            if (stateIndex === StateIndex.S_NULL) {
                this.sprite.set(null);
                return;
            }

            this.state = states[stateIndex];
            this.stateIndex = stateIndex;
            this.ticks = this.state.tics;
            this.stateAction(this.state.action);
            stateIndex = this.state.nextState;
        } while (!this.ticks)

        if (this.state === lastState) {
            // don't change sprite if the state hasn't changed
            return;
        }
        const name = SpriteNames[this.state.sprite];
        const frame = this.state.frame & FF_FRAMEMASK;
        const fullbright = (this.state.frame & FF_FULLBRIGHT) !== 0;
        this.sprite.set({ name, frame, fullbright });
    }

    randomizeTicks() {
        if (this.ticks > 0) {
            this.ticks = randInt(1, this.ticks);
        }
    }
}

class PlayerWeapon implements IPlayerWeapon {
    private player: PlayerMapObject;
    private _sprite = new SpriteStateMachine(action => weaponActions[action]?.(this.player, this));
    private _flashSprite = new SpriteStateMachine(action => weaponActions[action]?.(this.player, this));
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

const clipAmmo: { [k in AmmoType]: number} = {
    'bullets': 10,
    'shells': 4,
    'rockets': 1,
    'cells': 20,
};

// pickup functions
// TODO: a little unit testing could make these cleaner
const updateInventory = (fn: (inv: PlayerInventory) => void) =>
    (player: PlayerMapObject) => {
        player.inventory.update(inv => {
            fn(inv);
            return inv;
        });
        return true;
    }

const addAmmo = (type: keyof PlayerInventory['ammo'], amount: number) =>
    (player: PlayerMapObject) => {
        let added = false;
        player.inventory.update(inv => {
            // TOOD: on nightmare and easy, we should give player double ammo
            if (inv.ammo[type].amount < inv.ammo[type].max) {
                inv.ammo[type].amount = Math.min(inv.ammo[type].amount + amount, inv.ammo[type].max);
                added = true;
            }
            return inv;
        });
        return added;
    }

const addhealth = (amount: number, behaviour: 'always' | 'max100') =>
    (player: PlayerMapObject) => {
        let added = false;
        player.health.update(health => {
            if (behaviour === 'always') {
                health = Math.min(200, health + amount);
                added = true;
            } else if (behaviour === 'max100' && health < 100) {
                health = Math.min(100, health + amount);
                added = true;
            }
            return health;
        })
        return added;
    }

const addKey = (card: string) =>
    (player: PlayerMapObject) => {
        let added = false;
        player.inventory.update(inv => {
            inv.keys += card;
            added = true;
            return inv;
        });
        // TODO: keep keys for net games
        return added;
    }

const giveWeapon = (weapon: PlayerWeapon) =>
    (player: PlayerMapObject) => {
        if (weapon.ammoType !== 'none') {
            addAmmo(weapon.ammoType, clipAmmo[weapon.ammoType] * 2)(player);
        }
        player.inventory.update(inv => {
            if (!inv.weapons.includes(weapon)) {
                // keep weapons in order
                inv.weapons.push(weapon);
                player.nextWeapon = weapon;
            }
            return inv;
        });
        // TODO: keep weapons for net games
        return true;
    };

// Adapted from https://doomwiki.org/wiki/Thing_types and combined/mixed with
// animation/state info from https://github.com/id-Software/DOOM/blob/master/linuxdoom-1.10/info.c#L135
// (both mobjinfo_t mobjinfo and state_t states)
// alternative? https://doomwiki.org/wiki/Doom_utilities

const monsters = [
    { type: 7, class: 'M', description: 'Spiderdemon' },
    { type: 9, class: 'M', description: 'Shotgun guy' },
    { type: 16, class: 'M', description: 'Cyberdemon' },
    { type: 58, class: 'M', description: 'Spectre' },
    { type: 64, class: 'M', description: 'Arch-vile' },
    { type: 65, class: 'M', description: 'Heavy weapon dude' },
    { type: 66, class: 'M', description: 'Revenant' },
    { type: 67, class: 'M', description: 'Mancubus' },
    { type: 68, class: 'M', description: 'Arachnotron' },
    { type: 69, class: 'M', description: 'Hell knight' },
    { type: 71, class: 'M', description: 'Pain elemental' },
    { type: 72, class: 'M', description: 'Commander Keen' },
    { type: 84, class: 'M', description: 'Wolfenstein SS' },
    { type: 3001, class: 'M', description: 'Imp' },
    { type: 3002, class: 'M', description: 'Demon' },
    { type: 3003, class: 'M', description: 'Baron of Hell' },
    { type: 3004, class: 'M', description: 'Zombieman' },
    { type: 3005, class: 'M', description: 'Cacodemon' },
    { type: 3006, class: 'M', description: 'Lost soul' },
];

const weaponItems: ThingType[] = [
    { type: 82, class: 'W', description: 'Super shotgun', onPickup: giveWeapon(weapons['super shotgun']) },
    { type: 2001, class: 'W', description: 'Shotgun', onPickup: giveWeapon(weapons['shotgun']) },
    { type: 2002, class: 'W', description: 'Chaingun', onPickup: giveWeapon(weapons['chaingun']) },
    { type: 2003, class: 'W', description: 'Rocket launcher', onPickup: giveWeapon(weapons['rocket launcher']) },
    { type: 2004, class: 'W', description: 'Plasma gun', onPickup: giveWeapon(weapons['plasma rifle']) },
    { type: 2005, class: 'W', description: 'Chainsaw', onPickup: giveWeapon(weapons['chainsaw']) },
    { type: 2006, class: 'W', description: 'BFG9000', onPickup: giveWeapon(weapons['bfg']) },
];

const ammunitions: ThingType[] = [
    { type: 17, class: 'A', description: 'Energy cell pack', onPickup: addAmmo('cells', 100) },
    { type: 2007, class: 'A', description: 'Clip', onPickup: addAmmo('bullets', 5) },
    { type: 2008, class: 'A', description: '4 shotgun shells', onPickup: addAmmo('shells', 4) },
    { type: 2010, class: 'A', description: 'Rocket', onPickup: addAmmo('rockets', 1) },
    { type: 2046, class: 'A', description: 'Box of rockets', onPickup: addAmmo('rockets', 5) },
    { type: 2047, class: 'A', description: 'Energy cell', onPickup: addAmmo('cells', 20) },
    { type: 2048, class: 'A', description: 'Box of bullets', onPickup: addAmmo('bullets', 50) },
    { type: 2049, class: 'A', description: 'Box of shotgun shells', onPickup: addAmmo('shells', 20) },
];

const items: ThingType[] = [
    { type: 83, class: 'I', description: 'Megasphere',
        onPickup: (player: PlayerMapObject) => {
            player.health.set(200);
            player.inventory.update(inv => {
                inv.armor = 200;
                return inv;
            });
            return true;
        }
    },
    { type: 2013, class: 'I', description: 'Supercharge', onPickup: addhealth(100, 'always') },
    { type: 2014, class: 'I', description: 'Health bonus', onPickup: addhealth(1, 'always') },
    { type: 2015, class: 'I', description: 'Armor bonus', onPickup: updateInventory(inv => inv.armor += 1) },
    { type: 2022, class: 'I', description: 'Invulnerability', onPickup: updateInventory(inv => inv.items.invincibilityTicks = 30 * 35) },
    { type: 2023, class: 'I', description: 'Berserk', onPickup: updateInventory(inv => inv.items.berserkTicks = 30 * 35) },
    { type: 2024, class: 'I', description: 'Partial invisibility', onPickup: updateInventory(inv => inv.items.invisibilityTicks = 30 * 35) },
    { type: 2026, class: 'I', description: 'Computer area map', onPickup: updateInventory(inv => inv.items.computerMap = true) },
    { type: 2045, class: 'I', description: 'Light amplification visor', onPickup: updateInventory(inv => inv.items.nightVisionTicks = 30 * 35) },
];

const powerups: ThingType[] = [
    { type: 8, class: 'P', description: 'Backpack',
        onPickup: (player: PlayerMapObject) => {
            player.inventory.update(inv => {
                inv.ammo.bullets.max = 400;
                inv.ammo.shells.max = 100;
                inv.ammo.rockets.max = 100;
                inv.ammo.cells.max = 600;

                inv.ammo.bullets.amount = Math.min(inv.ammo.bullets.max, inv.ammo.bullets.amount + 10);
                inv.ammo.shells.amount = Math.min(inv.ammo.shells.max, inv.ammo.shells.amount + 4);
                inv.ammo.rockets.amount = Math.min(inv.ammo.rockets.max, inv.ammo.rockets.amount + 1);
                inv.ammo.cells.amount = Math.min(inv.ammo.cells.max, inv.ammo.cells.amount + 20);
                return inv;
            });
            return true;
        }
    },
    { type: 2011, class: 'P', description: 'Stimpack', onPickup: addhealth(10, 'max100') },
    { type: 2012, class: 'P', description: 'Medikit', onPickup: addhealth(25, 'max100') },
    { type: 2018, class: 'P', description: 'Armor',
        onPickup: (player: PlayerMapObject) => {
            let changed = false;
            player.inventory.update(inv => {
                if (inv.armor < 100) {
                    inv.armor = 100;
                    changed = true;
                }
                return inv;
            });
            return changed;
        },
    },
    { type: 2019, class: 'P', description: 'Megaarmor', onPickup: updateInventory(inv => inv.armor = 200) },
    { type: 2025, class: 'P', description: 'Radiation shielding suit', onPickup: updateInventory(inv => inv.items.radiationSuitTicks = 30 * 35) },
];

const keys: ThingType[] = [
    { type: 5, class: 'K', description: 'Blue keycard', onPickup: addKey('B') },
    { type: 6, class: 'K', description: 'Yellow keycard', onPickup: addKey('Y') },
    { type: 13, class: 'K', description: 'Red keycard', onPickup: addKey('R') },
    { type: 38, class: 'K', description: 'Red skull key', onPickup: addKey('r') },
    { type: 39, class: 'K', description: 'Yellow skull key', onPickup: addKey('y') },
    { type: 40, class: 'K', description: 'Blue skull key', onPickup: addKey('b') },
];

const obstacles = [
    { type: 25, class: 'O', description: 'Impaled human' },
    { type: 26, class: 'O', description: 'Twitching impaled human' },
    { type: 27, class: 'O', description: 'Skull on a pole' },
    { type: 28, class: 'O', description: 'Five skulls "shish kebab"' },
    { type: 29, class: 'O', description: 'Pile of skulls and candles' },
    { type: 30, class: 'O', description: 'Tall green pillar' },
    { type: 31, class: 'O', description: 'Short green pillar' },
    { type: 32, class: 'O', description: 'Tall red pillar' },
    { type: 33, class: 'O', description: 'Short red pillar' },
    { type: 35, class: 'O', description: 'Candelabra' },
    { type: 36, class: 'O', description: 'Short green pillar with beating heart' },
    { type: 37, class: 'O', description: 'Short red pillar with skull' },
    { type: 41, class: 'O', description: 'Evil eye' },
    { type: 42, class: 'O', description: 'Floating skull' },
    { type: 43, class: 'O', description: 'Burnt tree' },
    { type: 44, class: 'O', description: 'Tall blue firestick' },
    { type: 45, class: 'O', description: 'Tall green firestick' },
    { type: 46, class: 'O', description: 'Tall red firestick' },
    { type: 47, class: 'O', description: 'Brown stump' },
    { type: 48, class: 'O', description: 'Tall techno column' },
    { type: 49, class: 'O', description: 'Hanging victim, twitching' },
    { type: 50, class: 'O', description: 'Hanging victim, arms out' },
    { type: 51, class: 'O', description: 'Hanging victim, one- legged' },
    { type: 52, class: 'O', description: 'Hanging pair of legs' },
    { type: 53, class: 'O', description: 'Hanging leg' },
    { type: 54, class: 'O', description: 'Large brown tree' },
    { type: 55, class: 'O', description: 'Short blue firestick' },
    { type: 56, class: 'O', description: 'Short green firestick' },
    { type: 57, class: 'O', description: 'Short red firestick' },
    { type: 70, class: 'O', description: 'Burning barrel' },
    { type: 73, class: 'O', description: 'Hanging victim, guts removed' },
    { type: 74, class: 'O', description: 'Hanging victim, guts and brain removed' },
    { type: 75, class: 'O', description: 'Hanging torso, looking down' },
    { type: 76, class: 'O', description: 'Hanging torso, open skull' },
    { type: 77, class: 'O', description: 'Hanging torso, looking up' },
    { type: 78, class: 'O', description: 'Hanging torso, brain removed' },
    { type: 85, class: 'O', description: 'Tall techno floor lamp' },
    { type: 86, class: 'O', description: 'Short techno floor lamp' },
    { type: 2028, class: 'O', description: 'Floor lamp' },
    { type: 2035, class: 'O', description: 'Exploding barrel' },
];

const decorations = [
    { type: 10, class: 'D', description: 'Bloody mess' },
    { type: 12, class: 'D', description: 'Bloody mess 2' },
    { type: 15, class: 'D', description: 'Dead player' },
    { type: 18, class: 'D', description: 'Dead former human' },
    { type: 19, class: 'D', description: 'Dead former sergeant' },
    { type: 20, class: 'D', description: 'Dead imp' },
    { type: 21, class: 'D', description: 'Dead demon' },
    { type: 22, class: 'D', description: 'Dead cacodemon' },
    { type: 23, class: 'D', description: 'Dead lost soul (invisible)' },
    { type: 24, class: 'D', description: 'Pool of blood and flesh' },
    { type: 34, class: 'D', description: 'Candle' },
    { type: 59, class: 'D', description: 'Hanging victim, arms out' },
    { type: 60, class: 'D', description: 'Hanging pair of legs' },
    { type: 61, class: 'D', description: 'Hanging victim, one- legged' },
    { type: 62, class: 'D', description: 'Hanging leg' },
    { type: 63, class: 'D', description: 'Hanging victim, twitching' },
    { type: 79, class: 'D', description: 'Pool of blood' },
    { type: 80, class: 'D', description: 'Pool of blood' },
    { type: 81, class: 'D', description: 'Pool of brains' },
];

const other = [
    { type: 1, class: 'S', description: 'Player 1 start' },
    { type: 2, class: 'S', description: 'Player 2 start' },
    { type: 3, class: 'S', description: 'Player 3 start' },
    { type: 4, class: 'S', description: 'Player 4 start' },
    { type: 11, class: 'S', description: 'Deathmatch start' },
    { type: 14, class: 'S', description: 'Teleport landing' },
    { type: 87, class: 'S', description: 'Spawn spot' },
    { type: 88, class: 'S', description: "Romero's head" },
    { type: 89, class: 'S', description: 'Monster spawner' },
];

interface ThingType {
    type: number;
    class: string; //'M' | 'W' | 'A' | 'I' | 'P' | 'K' | 'O' | 'D' | 'S';
    description: string;
    onPickup?: (mo: MapObject) => boolean;
}

export interface ThingSpec extends ThingType {
    mo: MapObjectInfo;
}

export const things = [monsters, weaponItems, ammunitions, items, powerups, keys, obstacles, decorations, other].flat();
export function thingSpec(type: number): ThingSpec {
    const t = things.find(e => e.type === type);
    const mo =
        // special handling for player starts
        (type <= 4 || type === 11) ? mapObjectInfo[0] :
        mapObjectInfo.find(e => e.doomednum === type);
    return { ...t, mo };
}