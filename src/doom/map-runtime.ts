import { store, type Store } from "./store";
import { MapData, type LineDef, type Thing, type Action } from "./map-data";
import { Object3D, Vector3 } from "three";
import { HALF_PI, ToRadians } from "./math";
import { PlayerMapObject, MapObject } from "./map-object";
import { sectorLightAnimations, triggerSpecial, type SpecialDefinition, type TriggerType } from "./specials";
import { ticksPerSecond, type Game, type GameTime, type ControllerInput, frameTickTime } from "./game";
import { mapObjectInfo, MapObjectIndex, MFFlags, SoundIndex } from "./doom-things-info";
import { thingSpec, inventoryWeapon } from "./things";
import type { InventoryWeapon } from "./things/weapons";
import { derived } from "svelte/store";

const episode4MusicMap = [
    'D_E3M4',
    'D_E3M2',
    'D_E3M3',
    'D_E1M5',
    'D_E2M7',
    'D_E2M4',
    'D_E2M6',
    'D_E2M5',
    'D_E1M9',
];
const doom2MusicMap = [
    "D_RUNNIN",
    "D_STALKS",
    "D_COUNTD",
    "D_BETWEE",
    "D_DOOM",
    "D_THE_DA",
    "D_SHAWN",
    "D_DDTBLU",
    "D_IN_CIT",
    "D_DEAD",
    "D_STLKS2",
    "D_THEDA2",
    "D_DOOM2",
    "D_DDTBL2",
    "D_RUNNI2",
    "D_DEAD2",
    "D_STLKS3",
    "D_ROMERO",
    "D_SHAWN2",
    "D_MESSAG",
    "D_COUNT2",
    "D_DDTBL3",
    "D_AMPIE",
    "D_THEDA3",
    "D_ADRIAN",
    "D_MESSG2",
    "D_ROMER2",
    "D_TENSE",
    "D_SHAWN3",
    "D_OPENIN",
    "D_EVIL",
    "D_ULTIMA",
];

interface AnimatedTexture {
    frames: string[];
    current: number;
    speed: number;
    target: Store<string>;
}

export class MapRuntime {
    readonly data: MapData; // TODO: make this non-public?
    private actions = new Set<Action>();
    private animatedTextures: AnimatedTexture[] = [];

    readonly player: PlayerMapObject;
    readonly input: GameInput;
    readonly stats = {
        totalItems: 0,
        totalKills: 0,
        totalSecrets: 0,
        elapsedTime: 0,
    };

    objs: MapObject[] = []; // TODO: make this readonly?
    // don't love this rev hack... we need a list with a subscribe method
    readonly rev = store(1);
    // for things that subscribe to game state (like settings) but are tied to the lifecycle of a map should push themselves here
    readonly disposables: (() => void)[] = [];
    readonly musicBuffer: Uint8Array;

    constructor(
        readonly name: string,
        readonly game: Game,
    ) {
        this.data = game.wad.readMap(name);

        const mapNum = parseInt(name.substring(3, 5)) - 1;
        const musicTrack = name.startsWith('E4') ? episode4MusicMap[mapNum] :
            game.episodic ? 'D_' + name :
            doom2MusicMap[mapNum];
        this.musicBuffer = game.wad.lumpByName(musicTrack).contents;

        // some maps (plutonia MAP28) have multiple player 1 starts (I guess for coop?) so make sure to findLast()
        const playerThing = this.data.things.findLast(e => e.type === 1);
        const inv = Object.assign(game.inventory, {
            items: {
                berserkTicks: 0,
                invincibilityTicks: 0,
                invisibilityTicks: 0,
                nightVisionTicks: 0,
                radiationSuitTicks: 0,
                computerMap: false,
                berserk: false,
            },
            keys: '',
        });
        this.player = new PlayerMapObject(store(inv), this, playerThing);
        // restore values from last level (and subscribe to preserve values for next level)
        this.player.health.set(game.inventory.health);
        this.player.health.subscribe(health => game.inventory.health = health);
        this.player.weapon.set(game.inventory.lastWeapon.fn());
        this.player.weapon.subscribe(weapon => {
            game.inventory.lastWeapon = inventoryWeapon(weapon.name);
            weapon.activate(this.player);
        });

        // must be done before creating GameInput and Camera so movement behaves properly
        Object3D.DEFAULT_UP.set(0, 0, 1);
        this.input = new GameInput(this, game.input);

        this.objs.push(this.player);
        this.data.things.forEach(e => this.initialThingSpawn(e));

        this.synchronizeSpecials();

        // initialize animated textures
        for (const sector of this.data.sectors) {
            this.initializeTextureAnimation(sector.ceilFlat, 'flat');
            this.initializeTextureAnimation(sector.floorFlat, 'flat');
        }
        for (const linedef of this.data.linedefs) {
            this.initializeTextureAnimation(linedef.right.lower, 'wall');
            this.initializeTextureAnimation(linedef.right.middle, 'wall');
            this.initializeTextureAnimation(linedef.right.upper, 'wall');
            if (linedef.left) {
                this.initializeTextureAnimation(linedef.left.lower, 'wall');
                this.initializeTextureAnimation(linedef.left.middle, 'wall');
                this.initializeTextureAnimation(linedef.left.upper, 'wall');
            }
        }
    }

    dispose() {
        this.disposables.forEach(sub => sub());
        this.disposables.length = 0;
    }

    private initialThingSpawn(thing: Thing): MapObject | undefined {
        const noSpawn = (false
            || thing.type === 0 // plutonia map 12, what?!
            || thing.type === 1
            || thing.type === 2
            || thing.type === 3
            || thing.type === 4
            || thing.type === 11
        );
        if (noSpawn) {
            return;
        }
        if (thing.flags & 0x0010 && this.game.mode === 'solo') {
            return; // multiplayer only
        }
        const skillMatch = (
            (thing.flags & 0x0001 && (this.game.skill === 1 || this.game.skill === 2)) ||
            (thing.flags & 0x0002 && (this.game.skill === 3)) ||
            (thing.flags & 0x0004 && (this.game.skill === 4 || this.game.skill === 5))
        );
        if (!skillMatch) {
            return;
        }

        const type = mapObjectInfo.findIndex(e => e.doomednum === thing.type);
        const mobj = this.spawn(type, thing.x, thing.y);
        mobj.direction.set(thing.angle * ToRadians);

        if (thing.flags & 0x0008) {
            mobj.info.flags |= MFFlags.MF_AMBUSH;
        }
        if (mobj.info.flags & MFFlags.MF_COUNTKILL) {
            this.stats.totalKills += 1;
        }
        if (mobj.info.flags & MFFlags.MF_COUNTITEM) {
            this.stats.totalItems += 1;
        }
    }

    spawn(moType: MapObjectIndex, x: number, y: number, z?: number) {
        const mobj = new MapObject(this, thingSpec(moType), { x, y });
        if (z !== undefined) {
            mobj.position.val.z = z;
        }
        this.objs.push(mobj);
        this.rev.update(v => v += 1);
        return mobj;
    }

    destroy(mobj: MapObject) {
        mobj.subsectors(subsector => subsector.mobjs.delete(mobj));
        // TODO: perf?
        this.objs = this.objs.filter(e => e !== mobj);
        this.rev.update(rev => rev += 1);
    }

    timeStep(time: GameTime) {
        this.stats.elapsedTime += time.delta;
        this.input.evaluate(time.delta);

        if (time.isTick) {
            this.tick();
        }
    }

    private tick() {
        this.actions.forEach(action => action(this.game.time));

        // update wall/flat animations
        this.animatedTextures.forEach(anim => {
            if (this.game.time.tick.val % anim.speed === 0) {
                anim.current = (anim.current + 1) % anim.frames.length;
                anim.target.set(anim.frames[anim.current]);
            }
        });

        this.objs.forEach(thing => thing.tick());
    }

    initializeTextureAnimation(target: Store<string>, type: 'wall' | 'flat') {
        if (!target) {
            return;
        }
        // wall/flat animations are all 8 ticks each
        const animInfoFn = type === 'wall' ? 'animatedWallInfo' : 'animatedFlatInfo';
        const speed = 8;
        target.subscribe(v => {
            const animInfo = this.game.wad[animInfoFn](v);
            if (animInfo) {
                this.animatedTextures.push({ frames: animInfo[1], current: animInfo[0], target, speed });
            } else {
                // remove animation that was applied to this target
                this.animatedTextures = this.animatedTextures.filter(e => e.target !== target);
            }
        })();
    }

    addAction(action: Action) {
        if (action) {
            this.actions.add(action);
        }
    }

    removeAction(action: Action) {
        this.actions.delete(action);
    }

    // Why a public function? Because "edit" mode can change these while
    // rendering the map and we want them to update
    synchronizeSpecials() {
        this.actions.clear();
        this.stats.totalSecrets = 0;
        for (const wall of this.data.linedefs) {
            if (wall.special === 48) {
                wall.xOffset = store(0);
                this.actions.add(() => wall.xOffset.update(n => n += 1));
            } else if (wall.special === 85) {
                wall.xOffset = store(0);
                this.actions.add(() => wall.xOffset.update(n => n -= 1));
            }
        }

        for (const sector of this.data.sectors) {
            const type = sector.type;
            const action = sectorLightAnimations[type]?.(this, sector);
            if (action) {
                this.actions.add(action);
            }

            if (type === 9) {
                this.stats.totalSecrets += 1;
            }
        }
    }

    triggerSpecial(linedef: LineDef, mobj: MapObject, trigger: TriggerType, side: -1 | 1 = -1) {
        const special = triggerSpecial(mobj, linedef, trigger, side);
        if (special && trigger !== 'W') {
            // TODO: if special is already triggered (eg. by walking over a line) the switch shouldn't trigger
            if (this.tryToggle(special, linedef, linedef.right.upper)) {
                return;
            }
            if (this.tryToggle(special, linedef, linedef.right.middle)) {
                return;
            }
            if (this.tryToggle(special, linedef, linedef.right.lower)) {
                return;
            }
        }
    }

    private tryToggle(special: SpecialDefinition, linedef: LineDef, tex: Store<string>) {
        const name = tex.val;
        const toggle = this.game.wad.switchToggle(name);
        if (!toggle || linedef.switchAction) {
            return false;
        }

        // play a different sound on level exit
        const sound = (linedef.special === 11 || linedef.special === 51)
            ? SoundIndex.sfx_swtchx : SoundIndex.sfx_swtchn;
        this.game.playSound(sound, linedef.right.sector);
        tex.set(toggle);
        if (!special.repeatable) {
            return true;
        }

        // it's a repeatable switch so restore the state after 1 second
        let ticks = ticksPerSecond; // 1 sec
        const action = () => {
            if (--ticks) {
                return;
            }
            // restore original state
            this.game.playSound(SoundIndex.sfx_swtchn, linedef.right.sector);
            tex.set(name);
            linedef.switchAction = null;
            this.removeAction(action);
        };
        linedef.switchAction = action;
        this.addAction(action);
        return true;
    }
}

const playerSpeeds = { // per-tick
    'run': 50,
    'walk': 25,
    'crawl?': 5,
    'gravity': 35,
}

const vec = new Vector3();
class GameInput {
    public pointerSpeed = 1.0;
    // Constrain the pitch of the camera
    public minPolarAngle = -HALF_PI;
    public maxPolarAngle = HALF_PI;

    private alwaysRun: Store<boolean>;
    private compassMove: Store<boolean>;
    private handledUsePress = false; // only one use per button press
    private get player() { return this.map.player };
    private obj = new Object3D();

    constructor(private map: MapRuntime, readonly input: ControllerInput) {
        this.obj.rotation.order = 'ZXY';
        const euler = this.obj.rotation;
        euler.x = 0;
        this.player.direction.subscribe(dir => {
            euler.z = dir - HALF_PI;
            this.obj.quaternion.setFromEuler(euler);
            this.obj.updateMatrix();
        });

        this.alwaysRun = this.map.game.settings.alwaysRun;
        this.compassMove = this.map.game.settings.compassMove;
        this.map.disposables.push(
            this.map.game.settings.noclip.subscribe(noclip => {
                if (noclip) {
                    this.player.info.flags |= MFFlags.MF_NOCLIP;
                } else {
                    this.player.info.flags &= ~MFFlags.MF_NOCLIP;
                }
            }),
            this.map.game.settings.freeFly.subscribe(freefly => {
                if (freefly) {
                    this.player.info.flags |= MFFlags.MF_NOGRAVITY;
                } else {
                    this.player.info.flags &= ~MFFlags.MF_NOGRAVITY;
                }
            }),
            derived(
                [this.map.game.settings.freelook, this.map.game.settings.cameraMode],
                ([freelook, cameraMode]) => freelook && cameraMode !== 'bird' && cameraMode !== 'ortho'
            ).subscribe(canPitch => {
                if (canPitch) {
                    this.minPolarAngle = -HALF_PI;
                    this.maxPolarAngle = HALF_PI;
                } else {
                    this.minPolarAngle = this.maxPolarAngle = 0;
                }
            }));
    }

    evaluate(delta: number) {
        if (this.player.isDead) {
            // TODO: we should handle use/click to restart the level
            return;
        }

        // change weapon
        let selectedWeapon: InventoryWeapon;
        const weapon = this.player.weapon.val;
        if (this.input.weaponIndex !== -1) {
            selectedWeapon = this.player.inventory.val.weapons[this.input.weaponIndex];
        } else if (this.input.weaponKeyNum) {
            let candidates = this.player.inventory.val.weapons.filter(e => e?.keynum === this.input.weaponKeyNum);
            let weapon = this.player.weapon.val;
            selectedWeapon =
                // key press for a weapon we haven't picked up (yet)
                candidates.length === 0 ? null :
                // normal case where the key press is for a weapon we have
                candidates.length === 1 ? candidates[0] :
                // some weapons (chainsaw and shotgun) use the same number slot so toggle
                (weapon.name === candidates[1].name) ? candidates[0] : candidates[1];
        }
        if (selectedWeapon && selectedWeapon.name !== weapon.name) {
            this.player.nextWeapon = selectedWeapon;
        }
        // clear for next eval
        this.input.weaponIndex = -1;
        this.input.weaponKeyNum = 0;

        // attack
        this.player.attacking = this.input.attack;

        // handle rotation movements
        const euler = this.obj.rotation;
        euler.z -= this.input.aim.x * 0.002 * this.pointerSpeed;
        euler.x -= this.input.aim.y * 0.002 * this.pointerSpeed;
        euler.x = Math.min(this.maxPolarAngle, Math.max(this.minPolarAngle, euler.x));
        this.player.direction.set(euler.z + HALF_PI);
        this.player.pitch.set(euler.x);
        // clear for next eval (only xy, z is used for camera zoom and does not affect gameplay)
        this.input.aim.setX(0).setY(0);

        this.input.move.x = Math.max(-1, Math.min(1, this.input.move.x));
        this.input.move.y = Math.max(-1, Math.min(1, this.input.move.y));
        this.input.move.z = Math.max(-1, Math.min(1, this.input.move.z));
        // After playing with DSDA doom for a bit, the movement doesn't feel quite right so need some tweaks
        // Some good info on: https://www.doomworld.com/forum/topic/87199-the-doom-movement-bible/

        const freeFly = this.player.info.flags & MFFlags.MF_NOGRAVITY;
        const dt = delta * delta / frameTickTime;
        let speed = this.input.slow ? playerSpeeds['crawl?'] :
            this.alwaysRun.val !== this.input.run ? playerSpeeds['run'] : playerSpeeds['walk'];
        if (this.player.onGround || freeFly) {
            if (freeFly && !this.input.slow) {
                speed *= 2;
            }
            if (this.input.move.y) {
                this.player.velocity.addScaledVector(this.forwardVec(), this.input.move.y * speed * dt);
            }
            if (this.input.move.x) {
                this.player.velocity.addScaledVector(this.rightVec(), this.input.move.x * speed * dt);
            }
            if (this.input.move.z && freeFly) {
                this.player.velocity.addScaledVector(this.upVec(), this.input.move.z * speed * dt);
            }
            if (freeFly) {
                // apply separate friction during freefly
                this.player.velocity.multiplyScalar(0.95);
            }
        } else {
            this.player.velocity.z -= playerSpeeds['gravity'] * dt;
        }

        const pos = this.player.position.val;
        if (!this.player.reactiontime) {
            this.player.xyMove();
        }

        // use stuff (switches, doors, etc)
        if (this.input.use && !this.handledUsePress) {
            this.handledUsePress = false;

            const ang = this.player.direction.val;
            vec.set(Math.cos(ang) * 64, Math.sin(ang) * 64, 0);
            this.map.data.traceRay(pos, vec, hit => {
                if ('line' in hit) {
                    if (hit.line.special) {
                        this.map.triggerSpecial(hit.line, this.player, 'S');
                    } else if (hit.line.left) {
                        const front = (hit.side === -1 ? hit.line.right : hit.line.left).sector;
                        const back = (hit.side === -1 ? hit.line.left : hit.line.right).sector;
                        const gap = Math.min(front.zCeil.val, back.zCeil.val) - Math.max(front.zFloor.val, back.zFloor.val);
                        if (gap > 0) {
                            return true; // allow trace to continue
                        }
                        this.map.game.playSound(SoundIndex.sfx_noway, this.player);
                    }
                    return false; // always stop on the first line (unless above says we can continue)
                }
                return true
            });
        }
        this.handledUsePress = this.input.use;
    }

    private rightVec() {
        return this.compassMove.val
            ? vec.set(1, 0, 0)
            : vec.setFromMatrixColumn(this.obj.matrix, 0);
    }

    private upVec() {
        return vec.set(0, 0, 1);
    }

    private forwardVec() {
        return (
            this.compassMove.val ? vec.set(0, 1, 0) :
            this.player.info.flags & MFFlags.MF_NOGRAVITY ? vec.set(0, 1, 0).applyQuaternion(this.obj.quaternion) :
            vec.setFromMatrixColumn(this.obj.matrix, 0).crossVectors(this.obj.up, vec)
        );
    }
}
