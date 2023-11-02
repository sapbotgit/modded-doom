import { getContext } from 'svelte'
import { MapTextures, type RenderSector } from './RenderData';
import { Game, MapRuntime, type GameSettings, store } from '../doom';
import { get, writable } from 'svelte/store';

export const createAppContext = () => {
    const url = writable(location.pathname);
    url.subscribe(url => history.pushState(null, null, url));
    addEventListener('popstate', () => url.set(location.pathname));

    const gameSettings: GameSettings = {
        freeFly: store(false),
        freelook: store(true),
        zAimAssist: store(true),
        invicibility: store(false),
        noclip: store(false),
        compassMove: store(false),
        timescale: store(1),
        cameraMode: store('1p'),
    };
    const settings = {
        ...gameSettings,
        targetFPS: 120,
        useTextures: store(true),
        wireframe: writable<'none' | 'visible' | 'all'>('none'),
        showBlockMap: writable(false),
    };
    const editor = writable({
        active: false,
        selected: null,
    });

    function loadSettings() {
        try {
            const prefs = JSON.parse(localStorage.getItem('doom-prefs'));
            Object.keys(settings).filter(k => prefs[k] !== undefined)
                .forEach(k => {
                    if (typeof settings[k] === 'object') {
                        settings[k].set(prefs[k]);
                    } else {
                        settings[k] = prefs[k]
                    };
                });
        } catch {
            console.warn('failed to restore preferences, using defaults');
        }
    }
    loadSettings();

    function saveSettings() {
        const obj = Object.keys(settings).reduce((o, k) => {
                o[k] = typeof settings[k] === 'object' ? get(settings[k]) : settings[k];
                return o;
            }, {});
        localStorage.setItem('doom-prefs', JSON.stringify(obj));
    }
    Object.keys(settings).filter(k => typeof settings[k] === 'object').forEach(k => settings[k].subscribe(saveSettings));

    return { url, settings, editor };
}

export const createGameContext = (game: Game) => {
    const textures = new MapTextures(game.wad);
    const wad = game.wad;
    return { game, wad, textures };
}

export const useAppContext = (): ReturnType<typeof createAppContext> =>
    getContext('doom-app-context');
export const useDoom = (): ReturnType<typeof createGameContext> =>
    getContext('doom-game-context');
export const useDoomMap = (): { map: MapRuntime, renderSectors: RenderSector[] } =>
    getContext('doom-map');