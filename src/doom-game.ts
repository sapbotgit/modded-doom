import { writable, get } from "svelte/store";
import type { DoomMap, LineDef, MapObject, Sector, Seg, SubSector, TreeNode } from "./doomwad";
import { Euler, Object3D, Vector3 } from "three";
import { StateIndex } from "./doom-things-info";
import { HALF_PI, QUARTER_PI, lineLineIntersect, lineCircleSweep, lineCircleIntersect, randInt, signedLineDistance, ToDegrees } from "./lib/Math";

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
const move = new Vector3();
const moveU = new Vector3();
const start = new Vector3();
class GameInput {
    public moveForward = false;
    public moveBackward = false;
    public moveLeft = false;
    public moveRight = false;
    public run = false;
    public slow = false;
    public mouse = { x: 0, y: 0 };

    public cameraMode: '1p' | '3p' | 'bird' = 'bird';
    public freeFly = false;
    public pointerSpeed = 1.0;
    // Set to constrain the pitch of the camera
    // Range is 0 to Math.PI radians
    public minPolarAngle = -HALF_PI;
    public maxPolarAngle = HALF_PI;
    // public maxPolarAngle = 0;
    // public minPolarAngle = 0;

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
        this._adjustForCollision(start, move)
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
        this.game.camera.position.update(vec => {
            if (this.cameraMode === '3p') {
                const followDist = 200;
                vec.x = -Math.sin(-euler.z) * followDist + this.obj.position.x;
                vec.y = -Math.cos(-euler.z) * followDist + this.obj.position.y;
                vec.z = Math.cos(-euler.x) * followDist + this.obj.position.z;
            } else if (this.cameraMode === 'bird') {
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
        const playerRadius = this.game.player.spec.mo.radius;

        const checkCollision2 = (linedef: LineDef) => {
            const sweep = lineCircleSweep(linedef.v, move, start, playerRadius);
            if (!sweep) {
                return;
            }

            if (linedef.flags & 0x0004 && !(linedef.flags & 0x0001)) {
                // two-sided
                const leftFloor = linedef.left.sector.values.zFloor;
                const rightFloor = linedef.right.sector.values.zFloor;
                const diff = signedLineDistance(linedef.v, start) > 0 ? leftFloor - rightFloor : rightFloor - leftFloor;
                // console.log('floor diff',diff,sec1===sec2)
                if (diff <= maxStepSize) {
                    return;
                }

                // TODO: low ceilings
                // TODO: triggers from edges that were walked over?
            }

            // slide along wall instead of moving through it
            vec.set(linedef.v[1].x - linedef.v[0].x, linedef.v[1].y - linedef.v[0].y, 0);
            move.projectOnVector(vec);
        }

        // TODO: surley we can do better than check _every_ linedef
        for (const lindef of this.map.linedefs) {
            checkCollision2(lindef);
        }

        // TODO: gravity?
        // TODO: walk bob?
        const end = vec2.copy(start).add(move).addScaledVector(moveU, this.player.spec.mo.radius);
        const sec2 = this.map.findSubSector(end.x, end.y);
        this.obj.position.z = sec2.sector.values.zFloor + playerCameraOffset;

        // let complete = false;

        // // See R_RenderBSPNode in r_bsp.c
        // const obj = this.obj;
        // const p = { x: start.x, y: end.y };
        // const viewAngle = get(this.game.player.direction);
        // const minViewAngle = viewAngle - QUARTER_PI;
        // const maxViewAngle = viewAngle + QUARTER_PI;
        // const len = 100000;
        // const minViewLine = [p, { x: p.x + Math.cos(minViewAngle) * len, y: p.y + Math.sin(minViewAngle) * len }];
        // const maxViewLine = [p, { x: p.x + Math.cos(maxViewAngle) * len, y: p.y + Math.sin(maxViewAngle) * len }];
        // visitNode(this.map.nodes[this.map.nodes.length - 1]);

        // function visitNode(node: TreeNode | SubSector) {
        //     if (complete) {
        //         return;
        //     }
        //     if ("segs" in node) {
        //         node.segs.forEach(seg => {
        //             const sd = signedLineDistance(seg.linedef.v, p);
        //             if (sd > 0 && sd < 1000) {
        //                 const point = intersectionPoint(seg.linedef.v, [start, end]);
        //                 if (point) {
        //                     obj.position.set(point.x, point.y, start.z);
        //                     complete = true;
        //                 }
        //             }
        //         });
        //         return;
        //     }

        //     let side = signedLineDistance(node.v, p);
        //     if (side < 0) {
        //         visitNode(node.childLeft);
        //         if (boxVisible(node.boundsRight)) {
        //             visitNode(node.childRight);
        //         }
        //     } else {
        //         visitNode(node.childRight);
        //         if (boxVisible(node.boundsLeft)) {
        //             visitNode(node.childLeft);
        //         }
        //     }
        // }

        // function boxVisible(b: TreeNode["boundsLeft"]) {
        //     let { bottom, top, left, right } = b;
        //     if (p.x < left) {
        //         if (p.y < top) {
        //             right = b.left;
        //             left = b.right;
        //         } else if (p.y > bottom) {
        //             // all good!
        //         } else {
        //             right = b.left;
        //         }
        //     } else if (p.x > right) {
        //         if (p.y < top) {
        //             bottom = b.top;
        //             top = b.bottom;
        //             left = b.right;
        //             right = b.left;
        //         } else if (p.y > bottom) {
        //             bottom = b.top;
        //             top = b.bottom;
        //         } else {
        //             left = b.right;
        //             bottom = b.top;
        //             top = b.bottom;
        //         }
        //     } else {
        //         if (p.y < top) {
        //             left = b.right;
        //             right = b.left;
        //             bottom = b.top;
        //         } else if (p.y > bottom) {
        //             top = b.bottom;
        //         } else {
        //             // all good!
        //         }
        //     }
        //     const s1 = signedLineDistance(minViewLine, { x: left, y: top });
        //     const s2 = signedLineDistance(minViewLine, { x: right, y: bottom });
        //     const s3 = signedLineDistance(maxViewLine, { x: left, y: top });
        //     const s4 = signedLineDistance(maxViewLine, { x: right, y: bottom });
        //     const visible =
        //         (p.x > left && p.x < right && p.y > top && p.y < bottom)
        //         || (s1 > 0 && s2 < 0)
        //         || (s3 > 0 && s4 < 0)
        //         || (s1 < 0 && s2 <0 && s3 > 0 && s4 > 0)
        //     return visible;
        // }
    }
}