import { store, type Store } from "./store";
import { MapData, type LineDef, type Thing, type Action } from "./map-data";
import { Euler, Object3D, Vector3 } from "three";
import { HALF_PI, normalizeAngle, ToRadians } from "./math";
import { PlayerMapObject, MapObject } from "./map-object";
import { sectorLightAnimations, triggerSpecial, type SpecialDefinition, type TriggerType } from "./specials";
import { ticksPerSecond, type Game, type GameTime, type ControllerInput, frameTickTime } from "./game";
import { mapObjectInfo, MapObjectIndex, MFFlags } from "./doom-things-info";
import { thingSpec, inventoryWeapon } from "./things";
import type { InventoryWeapon } from "./things/weapons";

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
    readonly camera: Camera;
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

    constructor(
        readonly name: string,
        readonly game: Game,
    ) {
        this.data = game.wad.readMap(name);

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
        this.camera = new Camera(this.player, this, game);
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
        mobj.direction.set(normalizeAngle(Math.PI + thing.angle * ToRadians));

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
        console.log('destroy',mobj.id)
        mobj.subsectors(subsector =>  subsector.mobjs.delete(mobj));
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

        // update camera after tick so we get correct z position from player
        this.camera.update();
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
        if (toggle) {
            if (special.repeatable && !linedef.buttonTimer) {
                let ticks = ticksPerSecond; // 1 sec
                const action = () => {
                    if (--ticks) {
                        return;
                    }
                    // restore original state
                    tex.set(name);
                    linedef.buttonTimer = null;
                    this.removeAction(action);
                }

                linedef.buttonTimer = action;
                this.addAction(action);
            }
            tex.set(toggle);
            return true;
        }
        return false;
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
    // Set to constrain the pitch of the camera
    public minPolarAngle = -HALF_PI;
    public maxPolarAngle = HALF_PI;

    private freeFly: Store<boolean>;
    private compassMove: Store<boolean>;
    private handledUsePress = false; // only one use per button press
    private get player() { return this.map.player };
    private obj = new Object3D();

    constructor(private map: MapRuntime, readonly input: ControllerInput) {
        const euler = this.map.camera.rotation.val;
        euler.x = HALF_PI;
        this.player.direction.subscribe(dir => {
            euler.z = dir + HALF_PI;
            this.obj.quaternion.setFromEuler(euler);
            this.obj.updateMatrix();
        });

        this.freeFly = this.map.game.settings.freeFly;
        this.compassMove = this.map.game.settings.compassMove;
        this.map.disposables.push(
            this.map.game.settings.noclip.subscribe(noclip => {
                if (noclip) {
                    this.player.info.flags |= MFFlags.MF_NOCLIP;
                } else {
                    this.player.info.flags &= ~MFFlags.MF_NOCLIP;
                }
            }),
            this.map.game.settings.freelook.subscribe(val => {
                if (val) {
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
            this.player.xyMove();
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
                (weapon.name === candidates[0].name) ? candidates[1] : candidates[0];
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
        const euler = this.map.camera.rotation.val;
        euler.z -= this.input.aim.x * 0.002 * this.pointerSpeed;
        euler.x -= this.input.aim.y * 0.002 * this.pointerSpeed;
        euler.x = Math.max(HALF_PI - this.maxPolarAngle, Math.min(HALF_PI - this.minPolarAngle, euler.x));
        this.player.direction.set(euler.z - HALF_PI);
        this.map.camera.zoom.update(zoom => zoom += this.input.aim.z);
        // clear for next eval
        this.input.aim.set(0, 0, 0);

        // handle direction movements
        this.input.move.normalize(); // ensure consistent movements in all directions
        // ^^^ this isn't very doom like but I'm not sure I want to change it

        const dt = delta * delta / frameTickTime;
        let speed = this.input.slow ? playerSpeeds['crawl?'] :
            this.input.run ? playerSpeeds['run'] : playerSpeeds['walk'];
        if (this.player.onGround || this.freeFly.val) {
            if (this.freeFly.val && !this.input.slow) {
                speed *= 2;
            }
            if (this.input.move.y) {
                this.player.velocity.addScaledVector(this.forwardVec(), this.input.move.y * speed * dt);
            }
            if (this.input.move.x) {
                this.player.velocity.addScaledVector(this.rightVec(), this.input.move.x * speed * dt);
            }
            if (this.input.move.z && this.freeFly.val) {
                this.player.velocity.addScaledVector(this.upVec(), this.input.move.z * speed * dt);
            }
            if (this.freeFly.val) {
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

            const ang = euler.z + HALF_PI;
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
        if (this.compassMove.val) {
            vec.set(0, 1, 0);
        } else if (this.freeFly.val) {
            // freelook https://stackoverflow.com/questions/63405094
            vec.set(0, 0, -1).applyQuaternion(this.obj.quaternion);
        } else {
            // move forward parallel to the xy-plane (camera.up is z-up)
            vec.setFromMatrixColumn(this.obj.matrix, 0);
            vec.crossVectors(this.obj.up, vec);
        }
        return vec;
    }
}

const _3pDir = new Vector3();
class Camera {
    private pos = new Vector3();
    private angle = new Euler(0, 0, 0, 'ZXY');

    readonly zoom = store(0);
    readonly rotation = store(this.angle);
    readonly position = store(this.pos);
    readonly mode: Game['settings']['cameraMode'];
    update: () => void;

    constructor(player: PlayerMapObject, map: MapRuntime, game: Game) {
        // TODO: should this really be in the core game? The more I think about it... the more I'd like to move it into svelte
        this.mode = game.settings.cameraMode;
        const pos = player.position.val;
        const freeFly = game.settings.freeFly;
        const sub = game.settings.cameraMode.subscribe(mode => {
            if (mode === '3p' || mode === '3p-noclip') {
                const shoulderOffset = 15;
                this.update = () => {
                    this.zoom.update(zoom => Math.max(50, Math.min(1000, zoom)));
                    const playerViewHeight = freeFly.val ? 41 : player.computeViewHeight(game.time);
                    this.pos.x = -Math.sin(-this.angle.z) * this.zoom.val + pos.x - shoulderOffset;
                    this.pos.y = -Math.cos(-this.angle.z) * this.zoom.val + pos.y;
                    this.pos.z = Math.cos(-this.angle.x) * this.zoom.val + pos.z + playerViewHeight;
                    if (mode === '3p') {
                        this.clipPosition(this.pos, map, player);
                    }
                    this.position.set(this.pos);
                    this.rotation.set(this.angle);
                };
            } else if (mode === 'ortho') {
                this.update = () => {
                    this.zoom.update(zoom => Math.max(50, Math.min(1000, zoom)));
                    this.angle.x = HALF_PI * 3 / 4;
                    this.pos.x = -Math.sin(-this.angle.z) * 300 + pos.x;
                    this.pos.y = -Math.cos(-this.angle.z) * 300 + pos.y;
                    this.pos.z = Math.cos(-this.angle.x) * 400 + pos.z + 41;
                    this.position.set(this.pos);
                    this.rotation.set(this.angle);
                };
            } else if (mode === 'bird') {
                this.update = () => {
                    this.zoom.update(zoom => Math.max(100, Math.min(1500, zoom)));
                    this.pos.set(pos.x, pos.y, pos.z + this.zoom.val);
                    this.position.set(this.pos);
                    this.angle.x = 0;
                    this.rotation.set(this.angle);
                }
            } else {
                this.update = () => {
                    const playerViewHeight = freeFly.val ? 41 : player.computeViewHeight(game.time);
                    this.pos.set(pos.x, pos.y, pos.z + playerViewHeight);
                    this.position.set(this.pos);
                    this.rotation.set(this.angle);
                };
            }
        });
        map.disposables.push(sub);
    }

    private clipPosition(pos: Vector3, map: MapRuntime, player: PlayerMapObject) {
        // clip to walls and ceiling/floor
        const sector = map.data.findSector(this.pos.x, this.pos.y);
        pos.z = Math.max(pos.z, sector.zFloor.val + 3, player.sector.val.zFloor.val + 3);
        pos.z = Math.min(pos.z, sector.zCeil.val - 3, player.sector.val.zCeil.val - 3);
        _3pDir.copy(pos).sub(player.position.val);
        map.data.traceRay(player.position.val, _3pDir, hit => {
            if ('line' in hit) {
                if (hit.line.left) {
                    return true; // two-sided so continue (we should check zvalues...)
                }
                pos.x = hit.point.x;
                pos.y = hit.point.y;
                return false;
            }
            return true;
        });
    }
}
