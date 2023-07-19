import { writable, get } from "svelte/store";
import type { DoomMap, Sector } from "./Map";
import { Euler, Object3D, Vector3 } from "three";
import { HALF_PI, randInt } from "./Math";
import type { MapObject } from "./MapObject";

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

const playerSpeeds = { // per-tick
    'run': 50,
    'walk': 25,
    'crawl?': 5,
}
const playerCameraOffset = 41;
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

    public noclip = true;
    public freeFly = false;
    public pointerSpeed = 1.0;
    // Set to constrain the pitch of the camera
    // Range is 0 to Math.PI radians
    public minPolarAngle = -HALF_PI;
    public maxPolarAngle = HALF_PI;
    // public maxPolarAngle = 0;
    // public minPolarAngle = 0;

    private get enablePlayerCollisions() { return !this.noclip; }
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

        const dt = delta * delta / frameTickTime;
        const speed = this.slow ? playerSpeeds['crawl?'] : this.run ? playerSpeeds['run'] : playerSpeeds['walk'];
        if (this.moveForward || this.moveBackward) {
            this.player.velocity.addScaledVector(this.forwardVec(), this.direction.y * speed * dt);
        }
        if (this.moveLeft || this.moveRight) {
            this.player.velocity.addScaledVector(this.rightVec(), this.direction.x * speed * dt);
        }

        if (this.enablePlayerCollisions) {
            const linedefs = this.map.xyCollisions(this.player, this.player.velocity);
            for (const linedef of linedefs) {
                // slide along wall instead of moving through it
                vec.set(linedef.v[1].x - linedef.v[0].x, linedef.v[1].y - linedef.v[0].y, 0);
                this.player.velocity.projectOnVector(vec);
            }
        }
        // apply gravity in PlayerMapObject only on ticks
        this.obj.position.x += this.player.velocity.x;
        this.obj.position.y += this.player.velocity.y;
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

        // update camera
        // TODO: walk bob?
        const mode = get(this.game.camera.mode);
        this.game.camera.position.update(p => {
            if (mode === '3p') {
                const followDist = 200;
                p.x = -Math.sin(-euler.z) * followDist + this.obj.position.x;
                p.y = -Math.cos(-euler.z) * followDist + this.obj.position.y;
                p.z = Math.cos(-euler.x) * followDist + this.obj.position.z;
            } else if (mode === 'bird') {
                const followDist = 250;
                euler.x = 0;
                p.x = this.obj.position.x;
                p.y = this.obj.position.y;
                p.z = followDist + this.obj.position.z;
            } else {
                p.x = this.obj.position.x;
                p.y = this.obj.position.y;
                p.z = this.obj.position.z + playerCameraOffset;
            }
            return p;
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
}