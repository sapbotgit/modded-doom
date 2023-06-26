type GameEvents = 'textureAnimationTick' | 'frameTick'
export class DoomGame {
    private animInterval: number;
    private frameInterval: number;
    private eventListeners = new Map<GameEvents, any[]>();

    constructor() {
        console.log('new game')
        // Doom uses "ticks" and animation is specified in terms of ticks.
        // All wall/flat animations are 8 ticks so we convert to ms
        this.animInterval = window.setInterval(
            () => this.eventListeners.get('textureAnimationTick')?.forEach(fn => fn()),
            (8 / 35) * 1000);
        this.frameInterval = window.setInterval(
            () => this.eventListeners.get('frameTick')?.forEach(fn => fn()),
            1000 / 35);
    }

    dispose() {
        clearInterval(this.animInterval);
        clearInterval(this.frameInterval);
    }

    addEventListener(name: GameEvents, fn: () => void) {
        const evs = this.eventListeners.get(name);
        if (!evs) {
            this.eventListeners.set(name, [fn]);
            return;
        }
        evs.push(fn);
    }

    removeEventListener(name: GameEvents, fn: () => void) {
        const evs = this.eventListeners.get(name) ?? [];
        this.eventListeners.set(name, evs.filter(e => e !== fn));
    }
}