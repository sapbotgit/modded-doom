import { getContext } from 'svelte'
import { MapTextures, type RenderSector } from './RenderData';
import { Game, MapRuntime, type GameSettings, store, type Store } from '../doom';
import { get, writable, type Writable } from 'svelte/store';
import type { Color, Euler, Vector3 } from 'three';

// TODO: so many "contexts". We should simplify

interface RangeSetting extends BaseSetting<number> {
    type: 'range';
    min: number;
    max: number;
    step: number;
}
const range = (cat: MenuSettingCategory, val: Writable<number>, text: string, min: number, max: number, step: number): RangeSetting => ({ type: 'range', cat, min, max, step, val, text });

interface OptionSetting extends BaseSetting<string> {
    type: 'option';
    options: string[];
}
const option = (cat: MenuSettingCategory, val: Writable<string>, text: string, options: string[]): OptionSetting => ({ type: 'option', cat, options, val, text });

interface ToggleSetting extends BaseSetting<boolean> {
    type: 'toggle';
}
const toggle = (cat: MenuSettingCategory, val: Writable<boolean>, text: string): ToggleSetting => ({ type: 'toggle', cat, val, text });

type MenuSettingCategory = 'normal' | 'advanced' | 'debug' | 'experimental';
interface BaseSetting<T> {
    text: string;
    cat: MenuSettingCategory;
    val: Writable<T>;
}
export type MenuSetting = RangeSetting | OptionSetting | ToggleSetting;

export const createAppContext = () => {
    const urlHash = writable(location.hash);
    urlHash.subscribe(hash => history.pushState(null, null, hash));
    addEventListener('popstate', () => urlHash.set(location.hash));

    const gameSettings: GameSettings = {
        freeFly: store(false),
        freelook: store(true),
        zAimAssist: store(true),
        invicibility: store(false),
        noclip: store(false),
        alwaysRun: store(true),
        compassMove: store(false),
        maxLostSouls: store(20),
        timescale: store(1),
        monsterAI: store('enabled'),
        cameraMode: store('1p'),
    };
    const settings = {
        ...gameSettings,
        targetFPS: 120,
        useTextures: store(true),
        wireframe: writable<'none' | 'visible' | 'all'>('none'),
        showBlockMap: writable(false),
        musicPlayback: writable<'synth' | 'soundfont' | 'off'>('synth'),
        musicVolume: writable(.4),
        soundVolume: writable(.8),
        mainVolume: writable(.8),
        experimentalSoundHacks: writable(false),
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

    const settingsMenu = [
        range('normal', settings.mainVolume, 'Main volume', 0, 1, .1),
        range('normal', settings.soundVolume, 'Sound volume', 0, 1, .1),
        range('normal', settings.musicVolume, 'Music volume', 0, 1, .1),
        option('normal', settings.musicPlayback, 'Music voice', ['synth', 'soundfont', 'off']),
        option('advanced', settings.cameraMode, 'Camera', ['bird', 'ortho', '1p', '3p', '3p-noclip', 'svg']),
        toggle('advanced', settings.zAimAssist, 'Auto Z-Aim'),
        toggle('advanced', settings.noclip, 'noclip'),
        toggle('advanced', settings.alwaysRun, 'Always run'),
        toggle('advanced', settings.freelook, 'Free look'),
        toggle('advanced', settings.freeFly, 'Free fly'),
        range('advanced', settings.maxLostSouls, 'Max Lost Souls', 0, 50, 5),
        range('advanced', settings.timescale, 'Timescale', 0.1, 2, .1),
        // toggle($editor.active, 'Inspector'),
        toggle('debug', settings.showBlockMap, 'Show blockmap'),
        toggle('debug', settings.useTextures, 'Show textures'),
        option('debug', settings.monsterAI, 'AI Mode', ['enabled', 'disabled', 'move-only', 'fast']),
        option('debug', settings.wireframe, 'Show geometry', ['none', 'visible', 'all']),
        // experimental
        toggle('experimental', settings.experimentalSoundHacks, 'Room accoustics (experimental)'),
    ];

    const audio = new AudioContext();
    return { urlHash, settings, settingsMenu, editor, audio };
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
export const useDoomMap = (): {
    map: MapRuntime,
    renderSectors: RenderSector[],
    skyColor: Color,
    camera: { position: Store<Vector3>, angle: Store<Euler> },
} =>
    getContext('doom-map');