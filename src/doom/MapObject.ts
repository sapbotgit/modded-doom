import { writable, type Writable } from "svelte/store";
import { thingSpec, type ThingSpec } from "./doom-things";
import { StateIndex, type State, MFFlags, SpriteNames, states } from "./doom-things-info";
import type { Position } from "@threlte/core";
import { Vector3 } from "three";
import { randInt, ToRadians } from "./Math";
import type { DoomMap, Thing } from "./Map";

interface Sprite {
    name: string;
    frame: number;
    fullbright: boolean;
}

const vec = new Vector3();
const FF_FULLBRIGHT = 0x8000;
const FF_FRAMEMASK = 0x7fff;
export class MapObject {
    readonly spec: ThingSpec;
    readonly position: Writable<Position>;
    readonly direction: Writable<number>;
    readonly sector = writable(null);
    readonly sprite = writable<Sprite>(null);
    readonly velocity = new Vector3();
    public zTarget: number;
    private state: State;
    private pos: Position;
    private ticks: number;

    get currentState() { return this._state; }
    private _state: StateIndex;

    constructor(private map: DoomMap, readonly source: Thing) {
        this.spec = thingSpec(source.type);
        const fromFloor = !(this.spec.mo.flags & MFFlags.MF_SPAWNCEILING);

        this.direction = writable(Math.PI + source.angle * ToRadians);
        this.position = writable({ x: source.x, y: source.y, z: 0 });
        this.position.subscribe(p => {
            this.pos = p;
            const sector = map.findSector(p.x, p.y);
            this.sector.set(sector);
        });
        this.sector.subscribe(sector => {
            this.zTarget = fromFloor ? sector.values.zFloor : (sector.values.zCeil - this.spec.mo.height);
        });

        this.setState(this.spec.mo.spawnstate);
        // initial spawn sets ticks a little randomly so animations don't all move at the same time
        if (this.ticks > 0) {
            this.ticks = randInt(1, this.state.tics);
        }
    }

    tick() {
        // friction
        // TODO: avoid friction on z?
        this.velocity.multiplyScalar(.90625);
        // gravity
        if (this.pos.z <= this.zTarget) {
            this.pos.z = this.zTarget;
            this.velocity.z = 0;
        } else {
            this.velocity.z -= 1;
        }
        this.updatePosition();

        if (!this.state || this.ticks === -1) {
            return;
        }

        this.ticks -= 1;
        if (this.ticks > 0) {
            return;
        }

        this.setState(this.state.nextState)
    }

    setState(stateIndex: number) {
        this._state = stateIndex;
        this.state = states[stateIndex];
        this.ticks = this.state.tics;

        const name = SpriteNames[this.state.sprite];
        const frame = this.state.frame & FF_FRAMEMASK;
        const fullbright = (this.state.frame & FF_FULLBRIGHT) !== 0;
        this.sprite.set({ name, frame, fullbright });
    }

    protected updatePosition() {
        const linedefs = this.map.xyCollisions(this, this.velocity);
        for (const linedef of linedefs) {
            // slide along wall instead of moving through it
            vec.set(linedef.v[1].x - linedef.v[0].x, linedef.v[1].y - linedef.v[0].y, 0);
            this.velocity.projectOnVector(vec);
        }
        this.position.update(pos => {
            pos.x += this.velocity.x;
            pos.y += this.velocity.y;
            pos.z += this.velocity.z;
            return pos;
        });
    }
}

export class PlayerMapObject extends MapObject {
    tick() {
        super.tick();

        const vel = this.velocity.length();
        if (this.currentState === StateIndex.S_PLAY && vel > .5) {
            this.setState(StateIndex.S_PLAY_RUN1);
        } else if (vel < .2) {
            this.setState(StateIndex.S_PLAY);
        }
    }

    protected updatePosition(): void {
        // only update gravity because xy is updated each frame alredy and we don't
        // want to apply velocity twice
        this.position.update(pos => {
            pos.z += this.velocity.z;
            return pos;
        });
    }
}