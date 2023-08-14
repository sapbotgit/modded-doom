import { store, type Store } from "./Store";
import { thingSpec } from "./doom-things";
import { StateIndex, type State, MFFlags, SpriteNames, states, type MapObjectInfo } from "./doom-things-info";
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
    private static objectCounter = 0;
    readonly id = MapObject.objectCounter++;

    // readonly spec: ThingSpec;
    readonly info: MapObjectInfo;
    readonly position: Store<Vector3>;
    readonly direction: Store<number>;
    readonly sector = store<Sector>(null);
    readonly sprite = store<Sprite>(null);
    readonly velocity = new Vector3();

    private state: State;
    private ticks: number;
    private sect: Sector;

    protected zFloor: number;

    get onGround() { return this.position.val.z <= this.zFloor; }
    get currentState() { return this._state; }
    private _state: StateIndex;

    constructor(private map: DoomMap, readonly source: Thing, info?: MapObjectInfo ) {
        this.info = info ?? thingSpec(source.type).mo;
        const fromCeiling = (this.info.flags & MFFlags.MF_SPAWNCEILING);

        this.direction = store(Math.PI + source.angle * ToRadians);
        this.position = store(new Vector3(source.x, source.y, 0));
        this.position.subscribe(p => {
            const sector = map.findSector(p.x, p.y);
            if (!this.sect) {
                // first time setting sector so set zpos
                p.z = sector.zFloor.val;
            }
            // svelte stores assume != when value is an object so we add a little extra smarts
            if (this.sect !== sector) {
                this.sect = sector;
                this.sector.set(sector);
            }
        });

        let floorChange: () => void;
        let ceilChange: () => void;
        this.sector.subscribe(sect => {
            // remove old subscriptions
            floorChange?.();
            ceilChange?.();
            let sectorChange = true;

            ceilChange = sect.zCeil.subscribe(ceil => {
                if (fromCeiling) {
                    this.zFloor = ceil - this.info.height;
                    this.position.val.z = this.zFloor;
                    this.position.set(this.position.val);
                }

                // TODO: also check for crushing/collision?
            });

            floorChange = sect.zFloor.subscribe(floor => {
                if (!fromCeiling) {
                    // check that we are on the ground before updating zFloor because if we were on the ground before
                    // change, we want to force object to the ground after the change
                    const onGround = this.onGround;
                    this.zFloor = floor;
                    if (sectorChange) {
                        // during sector change, don't reset pos.z and let object fall
                        this.applyGravity();
                        sectorChange = false;
                        return;
                    }
                    if (onGround) {
                        this.position.val.z = floor;
                        this.position.set(this.position.val);
                    }
                }

                // TODO: also check for crushing/collision?
            });

            return () => {
                floorChange?.();
                ceilChange?.();
            }
        });

        this.setState(this.info.spawnstate);
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
        if (stateIndex === 0) {
            this.map.destroy(this);
            return;
        }

        this._state = stateIndex;
        this.state = states[stateIndex];
        this.ticks = this.state.tics;

        const name = SpriteNames[this.state.sprite];
        const frame = this.state.frame & FF_FRAMEMASK;
        const fullbright = (this.state.frame & FF_FULLBRIGHT) !== 0;
        this.sprite.set({ name, frame, fullbright });
    }

    teleport(target: Thing, sector: Sector) {
        this.velocity.set(0, 0, 0);
        this.position.val.x = target.x;
        this.position.val.y = target.y;
        this.position.val.z = sector.zFloor.val;
        this.position.set(this.position.val);
        this.direction.set(Math.PI + target.angle * ToRadians);
        // TODO: 18-tick freeze (reaction) time?
    }

    // make more like P_ZMovement?
    protected applyGravity() {
        if (this.onGround) {
            this.position.val.z = this.zFloor;
            this.velocity.z = 0;
        } else {
            this.velocity.z -= 1;
        }
    }

    // make more like P_XYMovement?
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
            },
            CollisionNoOp);
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
        // smooth step up
        if (this.position.val.z < this.zFloor) {
            this.viewHeight -= this.zFloor - this.position.val.z;
            // this means we change view height by 1, 2, or 3 depending on the step (>> 3 is equivalent to divide by 8 but faster)
            this.deltaViewHeight = (playerViewHeightDefault - this.viewHeight) >> 3;
        }

        if (this.onGround) {
            if (this.velocity.z < -8) {
                // if we hit the ground hard, drop the screen a bit
                this.deltaViewHeight = this.velocity.z >> 3;
            }
            this.velocity.z = 0;

            if (this.position.val.z !== this.zFloor) {
                this.position.val.z = this.zFloor;
                this.position.set(this.position.val);
            }
        }
    }

    // P_CalcHeight in p_user.c
    computeViewHeight(game: DoomGame) {
        const delta = game.lastDelta;
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
            // small acceleration of delta over time
            this.deltaViewHeight += delta / 4;
        }

        if (this.viewHeight < playerViewHeightDefault && this.deltaViewHeight === 0) {
            this.deltaViewHeight = 1;
        }

        const maxBox = Math.min(this.velocity.lengthSq(), playerMaxBob) / 2;
        const bob = Math.sin(Math.PI * 2 * bobTime * game.elapsedTime) * maxBox;

        let viewHeight = this.viewHeight + bob;

        // TODO: check higher than ceiling?
        return viewHeight;
    }
}