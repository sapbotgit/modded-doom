import { writable } from "svelte/store";
import type { DoomMap, LineDef } from "./doomwad";

export class DoomGame {
    private frameInterval: number;
    private frameCount = 0;

    private scrollingWalls: LineDef[] = [];

    constructor(private map: DoomMap) {
        this.frameInterval = window.setInterval(() => this.frameTick(), 1000 / 35);

        this.scrollingWalls = map.linedefs.filter(e => e.special === 48 || e.special === 85);
        this.scrollingWalls.forEach(ld => ld.xOffset = writable(0));
    }

    dispose() {
        clearInterval(this.frameInterval);
    }

    private frameTick() {
        this.frameCount += 1;

        // wall/flat animations are 8 ticks
        if (this.frameCount % 8 === 0) {
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
