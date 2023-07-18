import { writable, get } from "svelte/store";
import type { DoomMap, LineDef, MapObject, Sector, Seg, SubSector, TreeNode } from "./doomwad";
import { Euler, Object3D, Vector3 } from "three";
import { StateIndex } from "./doom-things-info";
import { HALF_PI, QUARTER_PI, lineLineIntersect, lineCircleSweep, lineCircleIntersect, randInt, signedLineDistance, ToDegrees, closestPoint, normal, dot } from "./lib/Math";

type Action = () => void;

const lowestLight = (sectors: Sector[], min: number) =>
    sectors.length === 0 ? 0 :
    sectors.map(s => s.source.light).reduce((last, val) => Math.min(last, val), min);

const randomFlicker = (map: DoomMap, sector: Sector) => {
    const max = sector.source.light;
    const min = lowestLight(map.sectorNeighbours(sector), max);
    let val = max;
    let ticks = 1;
    return () => {
        if (--ticks) {
            return;
        }
        if (val === max) {
            ticks = randInt(1, 7);
            val = min;
        } else {
            ticks = randInt(1, 64);
            val = max;
        }
        sector.light.set(val);
    };
};

const strobeFlash =
    (lightTicks: number, darkTicks: number, synchronized = false) =>
    (map: DoomMap, sector: Sector) => {
        const max = sector.source.light;
        const min = lowestLight(map.sectorNeighbours(sector), max);
        let ticks = synchronized ? 1 : randInt(1, 7);
        let val = max;
        return () => {
            if (--ticks) {
                return;
            }
            if (val === max) {
                ticks = darkTicks;
                val = min;
            } else {
                ticks = lightTicks;
                val = max;
            }
            sector.light.set(val);
        };
    };

const glowLight = (map: DoomMap, sector: Sector) => {
    const max = sector.source.light;
    const min = lowestLight(map.sectorNeighbours(sector), max);
    let val = max;
    let step = -8;
    return () => {
        val += step;
        if (val <= min || val >= max) {
            step = -step;
            val += step;
        }
        sector.light.set(val);
    };
};

const fireFlicker = (map: DoomMap, sector: Sector) => {
    const max = sector.source.light;
    const min = lowestLight(map.sectorNeighbours(sector), max) + 16;
    let ticks = 4;
    return () => {
        if (--ticks) {
            return;
        }
        ticks = 4;
        const amount = randInt(0, 2) * 16;
        sector.light.set(Math.max(max - amount, min));
    }
};

const sectorAnimations = {
    1: randomFlicker,
    2: strobeFlash(5, 15),
    3: strobeFlash(5, 35),
    4: strobeFlash(5, 35),
    8: glowLight,
    12: strobeFlash(5, 35, true),
    13: strobeFlash(5, 15, true),
    17: fireFlicker,
};

const frameTickTime = 1 / 35; // 35 tics/sec
export class DoomGame {
    private elapsedTime = 0; // seconds
    private nextTickTime = 0; // seconds
    currentTick = 0;

    readonly player: MapObject;
    readonly camera = {
        rotation: writable(new Euler(0, 0, 0, 'ZXY')),
        position: writable(new Vector3()),
        mode: writable<'1p' | '3p' | 'bird'>('1p'),
    }
    readonly input: GameInput;

    private actions: Action[];

    constructor(private map: DoomMap) {
        this.synchronizeActions();
        this.player = map.objs.find(e => e.source.type === 1);
        this.input = new GameInput(map, this);
    }

    tick(delta: number) {
        // handle input as fast as possible
        this.input.evaluate(delta);
        this.elapsedTime += delta;

        while (this.elapsedTime > this.nextTickTime) {
            this.frameTick();
        }
    }

    frameTick() {
        this.nextTickTime = this.nextTickTime + frameTickTime;
        this.currentTick += 1;

        this.actions.forEach(action => action());

        // update wall/flat animations
        this.map.animatedTextures.forEach(anim => {
            if (this.currentTick % anim.speed === 0) {
                anim.current = (anim.current + 1) % anim.frames.length;
                anim.target.set(anim.frames[anim.current]);
            }
        });

        this.map.objs.forEach(thing => thing.tick());
    }

    // Why a public function? Because "edit" mode can change these while
    // rendering the map and we want them to update
    synchronizeActions() {
        this.actions = [];
        for (const wall of this.map.linedefs) {
            if (wall.special === 48) {
                wall.xOffset = writable(0);
                this.actions.push(() => wall.xOffset.update(n => n += 1));
            } else if (wall.special === 85) {
                wall.xOffset = writable(0);
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

const playerCameraOffset = 41;
const euler = new Euler(0, 0, 0, 'ZYX');
const vec = new Vector3();
const vec2 = new Vector3();
const nw = new Vector3();
const ne = new Vector3();
const se = new Vector3();
const sw = new Vector3();
const move = new Vector3();
const moveU = new Vector3();
const moveUR = new Vector3();
const start = new Vector3();
class GameInput {
    public moveForward = false;
    public moveBackward = false;
    public moveLeft = false;
    public moveRight = false;
    public run = false;
    public slow = false;
    public mouse = { x: 0, y: 0 };

    public noclip = false;
    public freeFly = true;
    public pointerSpeed = 1.0;
    // Set to constrain the pitch of the camera
    // Range is 0 to Math.PI radians
    public minPolarAngle = -HALF_PI;
    public maxPolarAngle = HALF_PI;
    // public maxPolarAngle = 0;
    // public minPolarAngle = 0;

    private get enableCollisions() { return !this.noclip; }
    private player: MapObject;
    private obj = new Object3D();
    private direction = new Vector3();

    constructor(private map: DoomMap, private game: DoomGame) {
        this.player = game.player;
        const position = get(this.player.position);
        this.obj.position.set(position.x, position.y, position.z);
        this.game.player.position.set(this.obj.position);

        euler.x = HALF_PI;
        euler.z = get(this.player.direction) + HALF_PI;
        this.obj.quaternion.setFromEuler(euler);
    }

    evaluate(delta: number) {
        // handle direction movements
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.y =  Number(this.moveForward) - Number(this.moveBackward);
        this.direction.normalize(); // ensure consistent movements in all directions

        // const speed = this.slow ? 50.0 : this.run ? 583.33 : 291.66
        const speed = this.slow ? 5.0 : this.run ? 50 : 25
        if (this.moveForward || this.moveBackward) {
            this.player.velocity.addScaledVector(this.forwardVec(), this.direction.y * speed * delta);
        }
        if (this.moveLeft || this.moveRight) {
            this.player.velocity.addScaledVector(this.rightVec(), this.direction.x * speed * delta);
        }

        // TODO: apply gravity

        start.copy(this.obj.position);
        move.copy(this.player.velocity);
        this._adjustForCollision(start, move);
        this.obj.position.add(move);
        this.game.player.position.set(this.obj.position);

        // handle rotation movements
        euler.setFromQuaternion(this.obj.quaternion);
        euler.z -= this.mouse.x * 0.002 * this.pointerSpeed;
        euler.x -= this.mouse.y * 0.002 * this.pointerSpeed;
        euler.x = Math.max(HALF_PI - this.maxPolarAngle, Math.min(HALF_PI - this.minPolarAngle, euler.x));
        this.obj.quaternion.setFromEuler(euler);
        this.obj.updateMatrix();
        this.game.player.direction.set(euler.z)

        // clear for next eval
        this.mouse.x = 0;
        this.mouse.y = 0;

        // TODO: move this into a "player" class? Maybe this class is the player class?
        const vel = this.player.velocity.length();
        if (this.game.player.currentState === StateIndex.S_PLAY && vel > .5) {
            this.game.player.setState(StateIndex.S_PLAY_RUN1);
        } else if (vel < 1) {
            this.game.player.setState(StateIndex.S_PLAY);
        }

        // update camera
        const mode = get(this.game.camera.mode);
        this.game.camera.position.update(vec => {
            if (mode === '3p') {
                const followDist = 200;
                vec.x = -Math.sin(-euler.z) * followDist + this.obj.position.x;
                vec.y = -Math.cos(-euler.z) * followDist + this.obj.position.y;
                vec.z = Math.cos(-euler.x) * followDist + this.obj.position.z;
            } else if (mode === 'bird') {
                const followDist = 250;
                euler.x = 0;
                vec.x = this.obj.position.x;
                vec.y = this.obj.position.y;
                vec.z = followDist + this.obj.position.z;
            } else {
                vec.x = this.obj.position.x;
                vec.y = this.obj.position.y;
                vec.z = this.obj.position.z + playerCameraOffset;
            }
            return vec;
        });
        this.game.camera.rotation.set(euler);
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

    private _adjustForCollision(start: Vector3, move: Vector3) {
        const maxStepSize = 24;

        moveU.copy(move).normalize();
        moveUR.set(-moveU.y, moveU.x, moveU.z);
        const playerRadius = this.game.player.spec.mo.radius;

        let closestLine: LineDef = null;
        let closestDist = 1e9; // something large
        const checkCollision2 = (linedef: LineDef): boolean => {
            if (!(linedef.flags & 0x0004)) {
                // one sided - don't collide if the direction is going from front-back on the line
                const n = normal(linedef.v);
                if (dot(n, move) <= 0) {
                    // direction and line will not cross
                    return;
                }
            }

            const hit = lineCircleSweep(linedef.v, move, start, playerRadius);
            // const hit = lineCircleIntersect(linedef.v, end, playerRadius);
            if (!hit) {
                return;
            }

            if (linedef.flags & 0x0004 && !(linedef.flags & 0x0001)) {
                // two-sided and non-blocking
                const leftFloor = linedef.left.sector.values.zFloor;
                const rightFloor = linedef.right.sector.values.zFloor;
                const diff = signedLineDistance(linedef.v, start) > 0 ? leftFloor - rightFloor : rightFloor - leftFloor;
                if (diff <= maxStepSize) {
                    return;
                }

                // TODO: low ceilings
                // TODO: triggers from edges that were walked over?
            }

            if (this.enableCollisions && signedLineDistance(linedef.v, end) > 0) {
                // slide along wall instead of moving through it
                vec.set(linedef.v[1].x - linedef.v[0].x, linedef.v[1].y - linedef.v[0].y, 0);
                move.projectOnVector(vec);
            }

            // const point = closestPoint(linedef.v, end);
            // const dx = point.x - end.x;
            // const dy = point.y - end.y;
            // const distSqToLine =  dx * dx + dy * dy
            // if (this.enableCollisions && distSqToLine < closestDist && signedLineDistance(linedef.v, end) > 0) {
            //     closestDist = distSqToLine
            //     closestLine = linedef;
            // }
        }

        let end = vec2.copy(start).add(move);
        nw.copy(end).addScaledVector(moveU, playerRadius);
        ne.copy(end).addScaledVector(moveUR, -playerRadius);
        se.copy(end).addScaledVector(moveU, -playerRadius);
        sw.copy(end).addScaledVector(moveUR, playerRadius);
        const linedefs = [
            ...this.map.blockmap.query(nw),
            ...this.map.blockmap.query(ne),
            ...this.map.blockmap.query(se),
            ...this.map.blockmap.query(sw),
        ].filter((e, i, arr) => arr.indexOf(e) === i);
        for (const linedef of linedefs) {
            checkCollision2(linedef);
        }

        if (closestLine) {
            // slide along wall instead of moving through it
            vec.set(closestLine.v[1].x - closestLine.v[0].x, closestLine.v[1].y - closestLine.v[0].y, 0);
            move.projectOnVector(vec);
        }

        // TODO: gravity?
        // TODO: walk bob?
        end = vec2.copy(start).add(move);
        const sec2 = this.map.findSubSector(end.x, end.y);
        this.obj.position.z = sec2.sector.values.zFloor + playerCameraOffset;
    }
}