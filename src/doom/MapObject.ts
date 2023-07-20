import { writable, type Writable } from "svelte/store";
import { thingSpec, type ThingSpec } from "./doom-things";
import { StateIndex, type State, MFFlags, SpriteNames, states } from "./doom-things-info";
import type { Position } from "@threlte/core";
import { Vector3 } from "three";
import { randInt, ToRadians } from "./Math";
import { CollisionNoOp, type DoomMap, type Sector, type Thing } from "./Map";
import type { DoomGame } from "./game";

interface Sprite {
    name: string;
    frame: number;
    fullbright: boolean;
}

const vec = new Vector3();
const stopVelocity = 0.001;
const friction = .90625;
const FF_FULLBRIGHT = 0x8000;
const FF_FRAMEMASK = 0x7fff;
export class MapObject {
    readonly spec: ThingSpec;
    readonly position: Writable<Position>;
    readonly direction: Writable<number>;
    readonly sector = writable<Sector>(null);
    readonly sprite = writable<Sprite>(null);
    readonly velocity = new Vector3();
    public zCeil: number;
    public zFloor: number;
    private state: State;
    protected pos: Position;
    private ticks: number;
    private sect: Sector;

    get onGround() { return this.pos.z <= this.zFloor; }
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
            // svelte stores assume != when value is an object so we have to be a little smarter
            if (this.sect !== sector) {
                this.sect = sector;
                this.sector.set(sector);
            }
        });
        this.sector.subscribe(sector => {
            this.zCeil = sector.values.zCeil;
            this.zFloor = fromFloor ? sector.values.zFloor : (sector.values.zCeil - this.spec.mo.height);
        });

        this.setState(this.spec.mo.spawnstate);
        // initial spawn sets ticks a little randomly so animations don't all move at the same time
        if (this.ticks > 0) {
            this.ticks = randInt(1, this.state.tics);
        }
    }

    tick() {
        // friction (not z because gravity)
        if (this.onGround) {
            this.velocity.x *= friction;
            this.velocity.y *= friction;
        }
        this.applyGravity();
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

    protected applyGravity() {
        if (this.onGround) {
            this.pos.z = this.zFloor;
            this.velocity.z = 0;
        } else {
            this.velocity.z -= 1;
        }
    }

    protected updatePosition() {
        if (this.velocity.lengthSq() < stopVelocity) {
            return;
        }

        this.map.xyCollisions(this, this.velocity,
            CollisionNoOp,
            linedef => {
                // slide along wall instead of moving through it
                vec.set(linedef.v[1].x - linedef.v[0].x, linedef.v[1].y - linedef.v[0].y, 0);
                this.velocity.projectOnVector(vec);
                return true;
            });
        this.position.update(pos => {
            pos.x += this.velocity.x;
            pos.y += this.velocity.y;
            pos.z += this.velocity.z;
            return pos;
        });
    }
}

const bobTime = 35 / 20;
const playerMaxBob = 16;
const playerViewHeightDefault = 41;
const playerViewHeightDefaultHalf = playerViewHeightDefault * .5;
export class PlayerMapObject extends MapObject {
    private viewHeight = playerViewHeightDefault;
    private deltaViewHeight = 0;

    constructor(map: DoomMap, source: Thing) {
        super(map, source);
        this.sector.subscribe(sector => {
            // step up
            if (this.pos.z < this.zFloor) {
                this.viewHeight -= this.zFloor - this.pos.z;
                // this means we change view height by 1, 2, or 3 depending on the step (>> 3 is equivalent to divide by 8 but faster)
                this.deltaViewHeight = (playerViewHeightDefault - this.viewHeight) >> 3;
                this.pos.z = this.zFloor;
            }
        });
    }

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
        // do nothing here because we already update the position in game input and
        // we don't want to double add velocity
    }

    protected applyGravity(): void {
        if (this.onGround) {
            super.applyGravity();
        }
        // do nothing because we already apply in game input
    }

    // P_CalcHeight in p_user.c
    computeViewHeight(game: DoomGame, delta: number) {
        // if (alive) {
        this.viewHeight += this.deltaViewHeight * 35 * delta;

        if (this.viewHeight > playerViewHeightDefault) {
            this.viewHeight = playerViewHeightDefault;
            this.deltaViewHeight = 0;
        }
        if (this.viewHeight < playerViewHeightDefaultHalf) {
            this.viewHeight = playerViewHeightDefaultHalf;
            if (this.deltaViewHeight <= 0) {
                this.deltaViewHeight = 1;
            }
        }

        if (this.deltaViewHeight) {
            // accelerate delta over time
            this.deltaViewHeight += this.deltaViewHeight * delta * 4
        }

        const maxBox = Math.min(this.velocity.lengthSq(), playerMaxBob) / 2;
        const bob = Math.sin(Math.PI * 2 * bobTime * game.elapsedTime) * maxBox;

        let viewHeight = this.viewHeight + bob;
        // TODO: check higher than ceiling?
        return viewHeight;
    }
}