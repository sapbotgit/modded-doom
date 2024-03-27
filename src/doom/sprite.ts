import { ActionIndex, SpriteNames, StateIndex, states, type State } from "./doom-things-info";
import type { RNG } from "./math";
import { store } from "./store";

const FF_FULLBRIGHT = 0x8000;
const FF_FRAMEMASK = 0x7fff;

export interface Sprite {
    name: string;
    frame: number;
    fullbright: boolean;
}

export class SpriteStateMachine {
    private ticks: number;
    private stateIndex: StateIndex;
    private state: State;
    readonly sprite = store<Sprite>(null);
    get ticsRemaining() { return this.ticks; }
    get index() { return this.stateIndex; }

    constructor(
        private stateAction: (action: ActionIndex) => void,
        // TODO: it would be nice not to need an action where state is null but weapons have one behaviour and monsters
        // have another and I'm not sure how to express them
        private onNull: (self: SpriteStateMachine) => void,
    ) {}

    tick() {
        if (!this.state || this.ticks < 0) {
            return;
        }
        this.ticks -= 1;
        if (this.ticks === 0) {
            this.setState(this.state.nextState);
        }
    }

    setState(stateIndex: StateIndex, tickOffset = 0) {
        const lastState = this.state;
        do {
            this.stateIndex = stateIndex;
            if (stateIndex === StateIndex.S_NULL) {
                this.onNull(this);
                return;
            }

            this.state = states[stateIndex];
            this.ticks = this.state.tics;
            this.stateAction(this.state.action);
            stateIndex = this.state.nextState;
        } while (!this.ticks)

        this.ticks = Math.max(0, this.ticks + tickOffset);
        if (this.state === lastState) {
            // don't change sprite if the state hasn't changed
            return;
        }
        this.sprite.update(sprite => {
            if (!sprite) {
                sprite = { name: '', frame: 0, fullbright: false };
            }
            sprite.name = SpriteNames[this.state.sprite];
            sprite.frame = this.state.frame & FF_FRAMEMASK;
            sprite.fullbright = (this.state.frame & FF_FULLBRIGHT) !== 0;
            return sprite;
        });
    }

    randomizeTicks(rng: RNG) {
        if (this.ticks > 0) {
            this.ticks = rng.int(1, this.ticks);
        }
    }
}
