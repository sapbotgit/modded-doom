import { writable } from "svelte/store";
import type { DoomMap, LineDef, Sector } from "./doomwad";

const randInt = (min: number, max: number) => Math.floor((Math.random() * (max - min)) + min);

type Action = () => void;

const lowestLight = (sectors: Sector[], min: number) =>
    sectors.map(s => s.wad.light).reduce((last, val) => Math.min(last, val), min);

const randomFlicker = (map: DoomMap, sector: Sector) => {
    const max = sector.wad.light;
    const min = lowestLight(map.sectorNeighbours(sector), max);
    let val = max;
    let ticks = 1;
    return () => {
        if (--ticks) return;
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
        const max = sector.wad.light;
        const min = lowestLight(map.sectorNeighbours(sector), max);
        let ticks = synchronized ? 1 : randInt(1, 7);
        let val = max;
        return () => {
            if (--ticks) return;
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
    const max = sector.wad.light;
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
    const max = sector.wad.light;
    const min = lowestLight(map.sectorNeighbours(sector), max) + 16;
    let ticks = 4;
    return () => {
        if (--ticks) return;
        ticks = 4;
        const amount = randInt(0, 2) * 16;
        sector.light.set(Math.min(max - amount, min));
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

export class DoomGame {
    private frameInterval: number;
    currentTick = 0;

    private actions: Action[] = [];

    constructor(private map: DoomMap) {
        this.frameInterval = window.setInterval(() => this.frameTick(), 1000 / 35);

        for (const wall of map.linedefs) {
            if (wall.special === 48) {
                wall.xOffset = writable(0);
                this.actions.push(() => wall.xOffset.update(n => n += 1));
            } else if (wall.special === 85) {
                wall.xOffset = writable(0);
                this.actions.push(() => wall.xOffset.update(n => n += 1));
            }
        }

        for (const sector of map.sectors) {
            const type = sector.type;
            const action = sectorAnimations[type]?.(map, sector);
            if (action) {
                this.actions.push(action);
            }
        }
    }

    dispose() {
        clearInterval(this.frameInterval);
    }

    private frameTick() {
        this.currentTick += 1;

        this.actions.forEach(action => action());

        // wall/flat animations are 8 ticks
        if (this.currentTick % 8 === 0) {
            this.map.animatedTextures.forEach(anim => {
                anim.current = (anim.current + 1) % anim.frames.length;
                anim.target.set(anim.frames[anim.current]);
            });
        }
    }
}
