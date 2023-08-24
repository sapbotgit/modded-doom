import { store, type Store } from "./Store";
import { type DoomMap } from "./Map";
import { Euler, Object3D, Vector3 } from "three";
import { HALF_PI, lineLineIntersect, signedLineDistance } from "./Math";
import { PlayerMapObject, type MapObject } from "./MapObject";
import { sectorAnimations, triggerSpecial, type SpecialDefinition, type TriggerType } from "./Specials";
import { MFFlags } from "./doom-things-info";
import type { LineDef } from "./types";

export type Action = () => void;

class Camera {
    private pos = new Vector3();
    private angle: Euler = new Euler(0, 0, 0, 'ZXY');
    private freeFly = false;
    private updatePosition: (pos: Vector3, angle: Euler) => void;

    readonly rotation = store(this.angle);
    readonly position = store(this.pos);
    mode = store<'1p' | '3p' | 'bird' | 'ortho'>('1p');

    constructor(player: PlayerMapObject, game: DoomGame) {
        this.mode.subscribe(mode => {
            if (mode === '3p' || mode === 'ortho') {
                const followDist = 200;
                this.updatePosition = (position, angle) => {
                    const playerViewHeight = this.freeFly ? 41 : player.computeViewHeight(game);
                    this.pos.x = -Math.sin(-euler.z) * followDist + position.x;
                    this.pos.y = -Math.cos(-euler.z) * followDist + position.y;
                    this.pos.z = Math.cos(-euler.x) * followDist + position.z + playerViewHeight;
                    this.position.set(this.pos);
                    this.rotation.set(angle)
                };
            } else if (mode === 'bird') {
                const followDist = 250;
                this.updatePosition = (position, angle) => {
                    this.pos.set(position.x, position.y, position.z + followDist);
                    this.position.set(this.pos);
                    angle.x = 0;
                    this.rotation.set(angle);
                }
            } else {
                this.updatePosition = (position, angle) => {
                    const playerViewHeight = this.freeFly ? 41 : player.computeViewHeight(game);
                    this.pos.set(position.x, position.y, position.z + playerViewHeight);
                    this.position.set(this.pos);
                    this.rotation.set(angle);
                };
            }
        });

        player.position.subscribe(pos => this.updatePosition(pos as Vector3, this.angle));
    }

    update(angle: Euler, freeFly: boolean) {
        this.freeFly = freeFly;
        this.angle = angle;
    }
}

const ticksPerSecond = 35;
const frameTickTime = 1 / ticksPerSecond;
export class DoomGame {
    private nextTickTime = 0; // seconds
    lastDelta = 0; // seconds
    elapsedTime = 0; // seconds
    currentTick = store(0);

    readonly player: MapObject;
    readonly camera: Camera;
    readonly input: GameInput;

    private actions: Action[];

    constructor(private map: DoomMap) {
        this.synchronizeActions();
        this.player = map.objs.find(e => e.source.type === 1);
        this.input = new GameInput(map, this);
        this.camera = new Camera(this.player as PlayerMapObject, this);
    }

    tick(delta: number) {
        // delta *= .2
        // lastDelta is a hack. we need a cleaner game loop
        this.lastDelta = delta;
        // handle input as fast as possible
        this.input.evaluate(delta);
        this.elapsedTime += delta;

        while (this.elapsedTime > this.nextTickTime) {
            this.frameTick();
        }
    }

    frameTick() {
        this.nextTickTime = this.nextTickTime + frameTickTime;
        this.currentTick.update(tick => tick += 1);

        this.actions.forEach(action => action());

        // update wall/flat animations
        this.map.animatedTextures.forEach(anim => {
            if (this.currentTick.val % anim.speed === 0) {
                anim.current = (anim.current + 1) % anim.frames.length;
                anim.target.set(anim.frames[anim.current]);
            }
        });

        this.map.objs.forEach(thing => thing.tick());
    }

    addAction(action: Action) {
        if (action && this.actions.indexOf(action) === -1) {
            this.actions.push(action);
        }
    }

    removeAction(action: Action) {
        // TODO: perf: recreating an array?
        this.actions = this.actions.filter(e => e !== action);
    }

    triggerSpecial(linedef: LineDef, mobj: MapObject, trigger: TriggerType, side: -1 | 1 = -1) {
        const special = triggerSpecial(this, this.map, linedef, mobj, trigger, side);
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
        const toggle = this.map.wad.switchToggle(name);
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

    // Why a public function? Because "edit" mode can change these while
    // rendering the map and we want them to update
    synchronizeActions() {
        this.actions = [];
        for (const wall of this.map.linedefs) {
            if (wall.special === 48) {
                wall.xOffset = store(0);
                this.actions.push(() => wall.xOffset.update(n => n += 1));
            } else if (wall.special === 85) {
                wall.xOffset = store(0);
                this.actions.push(() => wall.xOffset.update(n => n -= 1));
            }
        }

        for (const sector of this.map.sectors) {
            const type = sector.type;
            const action = sectorAnimations[type]?.(this.map, sector);
            if (action) {
                this.actions.push(action);
            }
        }
    }
}

const slideMove = (mobj: MapObject, x: number, y: number) => {
    // slide along wall instead of moving through it
    vec.set(x, y, 0);
    // we are only interested in cancelling xy movement so preserve z
    const z = mobj.velocity.z;
    mobj.velocity.projectOnVector(vec);
    mobj.velocity.z = z;
};

const playerSpeeds = { // per-tick
    'run': 50,
    'walk': 25,
    'crawl?': 5,
    'gravity': 35,
}

const euler = new Euler(0, 0, 0, 'ZYX');
const vec = new Vector3();
class GameInput {
    public moveForward = false;
    public moveBackward = false;
    public moveLeft = false;
    public moveRight = false;
    public run = false;
    public slow = false;
    public use = false;
    public attack = false;
    public weaponSelect = 0;
    public mouse = { x: 0, y: 0 };

    public freelook = store(true);
    public noclip = false;
    public freeFly = false;
    public pointerSpeed = 1.0;
    // Set to constrain the pitch of the camera
    public minPolarAngle = -HALF_PI;
    public maxPolarAngle = HALF_PI;

    private handledUsePress = false; // only one use per button press
    private get enablePlayerCollisions() { return !this.noclip; }
    private get player() { return this.game.player as PlayerMapObject };
    private obj = new Object3D();
    private direction = new Vector3();

    constructor(private map: DoomMap, private game: DoomGame) {
        euler.x = HALF_PI;
        this.player.direction.subscribe(dir => {
            euler.z = dir + HALF_PI;
            this.obj.quaternion.setFromEuler(euler);
            this.obj.updateMatrix();
            euler.setFromQuaternion(this.obj.quaternion);
        });

        this.freelook.subscribe(val => {
            if (val) {
                this.minPolarAngle = -HALF_PI;
                this.maxPolarAngle = HALF_PI;
            } else {
                this.minPolarAngle = this.maxPolarAngle = 0;
            }
        });
    }

    evaluate(delta: number) {
        // change weapon
        if (this.weaponSelect) {
            let nextWeapon = this.player.inventory.val.weapons.filter(e => e.num === this.weaponSelect);
            let weapon = this.player.weapon.val;
            let selectedWeapon =
                // key press for a weapon we haven't picked up (yet)
                nextWeapon.length === 0 ? null :
                nextWeapon.length === 1 ? nextWeapon[0] :
                // chainsaw and shotgun use the same number slot so we toggle
                (weapon === nextWeapon[0]) ? nextWeapon[1] : nextWeapon[0];
            if (selectedWeapon && selectedWeapon !== weapon) {
                this.player.nextWeapon = selectedWeapon;
            }
            this.weaponSelect = 0;
        }

        // attack
        this.player.attacking = this.attack;

        // handle rotation movements
        euler.z -= this.mouse.x * 0.002 * this.pointerSpeed;
        euler.x -= this.mouse.y * 0.002 * this.pointerSpeed;
        euler.x = Math.max(HALF_PI - this.maxPolarAngle, Math.min(HALF_PI - this.minPolarAngle, euler.x));
        this.player.direction.set(euler.z - HALF_PI);
        this.game.camera.update(euler, this.freeFly);

        // clear for next eval
        this.mouse.x = 0;
        this.mouse.y = 0;

        // handle direction movements
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.y =  Number(this.moveForward) - Number(this.moveBackward);
        this.direction.normalize(); // ensure consistent movements in all directions
        // ^^^ this isn't very doom like but I don't want to change it

        const dt = delta * delta / frameTickTime;
        let speed = this.slow ? playerSpeeds['crawl?'] : this.run ? playerSpeeds['run'] : playerSpeeds['walk'];
        if (this.player.onGround || this.freeFly) {
            if (this.freeFly && !this.slow) {
                speed *= 2;
            }
            if (this.moveForward || this.moveBackward) {
                this.player.velocity.addScaledVector(this.forwardVec(), this.direction.y * speed * dt);
            }
            if (this.moveLeft || this.moveRight) {
                this.player.velocity.addScaledVector(this.rightVec(), this.direction.x * speed * dt);
            }
            if (this.freeFly) {
                // apply separate friction during freefly
                this.player.velocity.multiplyScalar(0.95);
            }
        } else {
            this.player.velocity.z -= playerSpeeds['gravity'] * dt;
        }

        const pos = this.player.position.val;
        if (this.enablePlayerCollisions) {
            this.map.xyCollisions(this.player, this.player.velocity,
                mobj => {
                    if (mobj.info.flags & MFFlags.MF_SPECIAL) {
                        this.player.pickup(mobj);
                        return true;
                    }
                    const dx = pos.x - mobj.position.val.x;
                    const dy = pos.y - mobj.position.val.y;
                    slideMove(this.player, -dy, dx);
                    return true;
                },
                linedef => {
                    slideMove(this.player, linedef.v[1].x - linedef.v[0].x, linedef.v[1].y - linedef.v[0].y);
                    return true;
                },
                (linedef, side) => {
                    this.game.triggerSpecial(linedef, this.player, 'W', side)
                    return true;
                });
        }

        if (this.use && !this.handledUsePress) {
            this.handledUsePress = false;

            const ang = euler.z + HALF_PI;
            vec.set(Math.cos(ang) * 64, Math.sin(ang) * 64, 0);
            const collisions = this.map.blockmap.trace(pos, 0, vec);
            vec.add(pos);
            const useLine = [pos, vec];
            for (const linedef of collisions.linedefs) {
                if (signedLineDistance(linedef.v, pos) < 0) {
                    // don't hit walls from behind
                    continue;
                }

                const hit = lineLineIntersect(linedef.v, useLine, true);
                if (!hit) {
                    continue;
                }

                if (linedef.special) {
                    this.game.triggerSpecial(linedef, this.player, 'S');
                    break;
                }
            }
        }
        this.handledUsePress = this.use;

        this.player.position.update(pos => {
            pos.x += this.player.velocity.x;
            pos.y += this.player.velocity.y;
            pos.z += this.player.velocity.z;
            return pos;
        });
    }

    private rightVec() {
        return vec.setFromMatrixColumn(this.obj.matrix, 0);
    }

    private forwardVec() {
        if (this.freeFly) {
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