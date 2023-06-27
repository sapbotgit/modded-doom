import { get, writable } from "svelte/store";
import type { DoomMap, LineDef, Sector } from "./doomwad";

const randInt = (min: number, max: number) => Math.floor((Math.random() * (max - min)) + min);

type Action = () => void;
interface GameAction {
    tick: number;
    run: Action;
}

const randomFlicker =
    (lightTicks: number, darkTicks: number) =>
    (game: DoomGame, sector: Sector) => {
        const max = get(sector.light);
        const min = 144; // todo: min light from neighbour sector
        function goMax() {
            game.schedule(randInt(1, lightTicks), goMin);
            sector.light.set(max);
        }
        function goMin() {
            game.schedule(randInt(1, darkTicks), goMax);
            sector.light.set(min);
        }
        game.schedule(1, goMax);
    };

const strobeFlash =
    (lightTicks: number, darkTicks: number, synchronized = false) =>
    (game: DoomGame, sector: Sector) => {
        const max = get(sector.light);
        const min = 144;
        function goMax() {
            game.schedule(lightTicks, goMin)
            sector.light.set(max);
        }
        function goMin() {
            game.schedule(darkTicks, goMax)
            sector.light.set(min);
        }
        game.schedule(synchronized ? 1 : randInt(1, 7), goMax);
    };

const glowLight =
    (game: DoomGame, sector: Sector) => {
        const max = get(sector.light);
        const min = 144;
        let val = max;
        let step = -8;
        function adjust() {
            val += step;
            if (val <= min) {
                val = min;
                step = -step;
            }
            if (val >= max) {
                val = max;
                step = -step;
            }
            sector.light.set(val);
            game.schedule(1, adjust);
        }
        game.schedule(1, adjust);
    };

const fireFlicker =
    (game: DoomGame, sector: Sector) => {
        const max = get(sector.light);
        const min = 144 + 16;
        function adjust() {
            game.schedule(4, adjust);
            const amount = randInt(0, 2) * 16;
            sector.light.set(Math.min(max - amount, min));
        }
        game.schedule(4, adjust);
    };

const sectorAnimations = {
    1: randomFlicker(64, 7),
    2: strobeFlash(5, 15),
    3: strobeFlash(5, 35),
    4: strobeFlash(5, 35),
    8: glowLight,
    12: strobeFlash(5, 35, true),
    13: strobeFlash(5, 15, true),
    17: fireFlicker,
};

export class DoomGame {
    private frameInterval: number;
    currentTick = 0;

    private actions: GameAction[] = [];
    private scrollingWalls: LineDef[] = [];

    constructor(private map: DoomMap) {
        this.frameInterval = window.setInterval(() => this.frameTick(), 1000 / 35);

        this.scrollingWalls = map.linedefs.filter(e => e.special === 48 || e.special === 85);
        this.scrollingWalls.forEach(ld => ld.xOffset = writable(0));

        for (const rsector of map.renderSectors) {
            const type = rsector.sector.type;
            sectorAnimations[type]?.(this, rsector.sector);
        }
    }

    dispose() {
        clearInterval(this.frameInterval);
    }

    schedule(relativeTick: number, action: Action) {
        const tick = relativeTick + this.currentTick;
        this.actions.push({ run: action, tick });
    }

    private frameTick() {
        this.currentTick += 1;

        this.actions.sort((a, b) => a.tick - b.tick);
        const actionIndex = this.actions.findLastIndex(action => action.tick < this.currentTick);
        if (actionIndex !== -1) {
            const actions = this.actions.splice(0, actionIndex + 1);
            for (const action of actions) {
                action.run();
            }
        }

        // wall/flat animations are 8 ticks
        if (this.currentTick % 8 === 0) {
            this.map.animatedTextures.forEach(anim => {
                anim.current = (anim.current + 1) % anim.frames.length;
                anim.target.set(anim.frames[anim.current]);
            });
        }

        for (const ld of this.scrollingWalls) {
            if (ld.special === 48) {
                ld.xOffset.update(n => n += 1)
            } else if (ld.special === 85) {
                ld.xOffset.update(n => n -= 1)
            }
        }
    }
}
