import { get, writable } from "svelte/store";
import type { DoomMap, MapObject, Sector } from "./doomwad";
import { Euler, Object3D, Vector3 } from "three";
import { HALF_PI } from "./lib/Math";

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min)) + min;

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
    readonly input: GameInput;

    private actions: Action[];

    constructor(private map: DoomMap) {
        this.synchronizeActions();
        this.player = map.renderThings.find(e => e.source.type === 1);
        this.input = new GameInput(map, this);
    }

    tick(delta: number) {
        // handle input as quickly as possible
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

        // wall/flat animations are 8 ticks
        if (this.currentTick % 8 === 0) {
            this.map.animatedTextures.forEach(anim => {
                anim.current = (anim.current + 1) % anim.frames.length;
                anim.target.set(anim.frames[anim.current]);
            });
        }

        this.map.renderThings.forEach(thing => thing.tick());
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
                this.actions.push(() => wall.xOffset.update(n => n += 1));
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

const euler = new Euler(0, 0, 0, 'ZYX');
const vec = new Vector3();
class GameInput {
    public moveForward = false;
    public moveBackward = false;
    public moveLeft = false;
    public moveRight = false;
    public run = false;
    public slow = false;
    public mouse = { x: 0, y: 0 };

    public freeFly = true;
    public pointerSpeed = 1.0;
    // Set to constrain the pitch of the camera
    // Range is 0 to Math.PI radians
    public minPolarAngle = -HALF_PI;
    public maxPolarAngle = HALF_PI;
    // public maxPolarAngle = 0;
    // public minPolarAngle = 0;

    private obj = new Object3D();
    private velocity = new Vector3();
    private direction = new Vector3();

    constructor(map: DoomMap, private game: DoomGame) {
        const playerHeight = 41;
        const p1 = game.player;
        const position = get(p1.position);
        this.obj.position.set(position.x, position.y, position.z + playerHeight);
        this.game.player.position.set(this.obj.position);

        const direction = get(p1.direction);
        const tx = 10 * Math.cos(direction) + position.x;
        const ty = 10 * Math.sin(direction) + position.y;
        this.obj.lookAt(tx, ty, this.obj.position.z);
        vec.copy(this.getDirection(vec))
        this.game.player.direction.set(Math.atan2(vec.y, vec.x));
    }

    evaluate(delta: number) {
        // handle direction movements
        this.velocity.x -= this.velocity.x * 5.0 * delta;
        this.velocity.y -= this.velocity.y * 5.0 * delta;
        this.velocity.z -= 9.8 * 100.0 * delta; // 100.0 = mass

        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.y =  Number(this.moveForward) - Number(this.moveBackward);
        this.direction.normalize(); // ensure consistent movements in all directions

        const speed = this.slow ? 500.0 : this.run ? 8000.0 : 4000.0
        if (this.moveForward || this.moveBackward) {
            this.velocity.y -= this.direction.y * speed * delta;
        }
        if (this.moveLeft || this.moveRight) {
            this.velocity.x -= this.direction.x * speed * delta;
        }

        this._moveRight(-this.velocity.x * delta);
        this._moveForward(-this.velocity.y * delta);
        this.game.player.position.set(this.obj.position);

        // handle rotation movements
        euler.setFromQuaternion(this.obj.quaternion);
        euler.z -= this.mouse.x * 0.002 * this.pointerSpeed;
        euler.x -= this.mouse.y * 0.002 * this.pointerSpeed;
        euler.x = Math.max(HALF_PI - this.maxPolarAngle, Math.min(HALF_PI - this.minPolarAngle, euler.x));
        this.obj.quaternion.setFromEuler(euler);
        this.obj.updateMatrix();
        this.game.player.pitch.set(euler.x)
        this.game.player.direction.set(euler.z)

        // clear for next eval
        this.mouse.x = 0;
        this.mouse.y = 0;
    }

    private getDirection(v: Vector3) {
        return v.set(0, 0, -1).applyQuaternion(this.obj.quaternion);
    }

    private _moveRight(distance: number) {
        vec.setFromMatrixColumn(this.obj.matrix, 0);
        this.obj.position.addScaledVector(vec, distance);
    }

    private _moveForward(distance: number) {
        // move forward parallel to the xz-plane
        // assumes camera.up is y-up
        if (this.freeFly) {
            // freelook https://stackoverflow.com/questions/63405094
            vec.copy(this.getDirection(vec));
        } else {
            vec.setFromMatrixColumn(this.obj.matrix, 0);
            vec.crossVectors(this.obj.up, vec);
        }
        this.obj.position.addScaledVector(vec, distance);
    }
}