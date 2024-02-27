import { getContext } from 'svelte'
import { MapTextures, type RenderSector } from './RenderData';
import { Game, MapRuntime, type GameSettings, store, type Store } from '../doom';
import { get, writable, type Writable } from 'svelte/store';
import type { Color, Euler, Vector3 } from 'three';
import { createPointerLockControls } from './Controls/PointerLockControls';

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
        xyAimAssist: store(false),
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
        showStats: writable(false),
        fpsLimit: writable(60),
        pixelScale: writable(1),
        useTextures: store(true),
        wireframe: writable<'off' | 'visible' | 'all'>('off'),
        showBlockMap: writable(false),
        musicPlayback: writable<'synth' | 'soundfont' | 'off'>('synth'),
        musicVolume: writable(.4),
        soundVolume: writable(.8),
        mainVolume: writable(.8),
        experimentalSoundHacks: writable(false),
        fakeContrast: writable<'classic' | 'gradual' | 'off'>('classic'),
        touchLookSpeed: writable(32),
        touchDeadZone: writable(0.2),
        tapTriggerTime: writable(0.2),
        analogMovement: writable(false),
        touchTargetSize: writable(10),
        touchTargetHzPadding: writable(1),
        touchTargetVPadding: writable(4),
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
        // TODO: we probably need a whole screen to help tweak touch controls.
        // Honestly, the whole menu is really unfriendly on mobile
        range('normal', settings.touchDeadZone, 'Touch control dead zone', .1, 1, 0.05),
        range('normal', settings.touchLookSpeed, 'Touch control look speed', 4, 64, 4),
        range('normal', settings.tapTriggerTime, 'Touch tap time', 0.1, 1, 0.05),
        toggle('normal', settings.analogMovement, 'Analog movement control'),
        option('advanced', settings.cameraMode, 'Camera', ['bird', 'ortho', '1p', '3p', '3p-noclip', 'svg']),
        range('advanced', settings.touchTargetSize, 'Touch control size', 1, 20, 1),
        range('advanced', settings.touchTargetHzPadding, 'Touch horizontal padding', 0, 4, .5),
        range('advanced', settings.touchTargetVPadding, 'Touch vertical padding', 0, 8, .5),
        toggle('advanced', settings.xyAimAssist, 'Aim assist'),
        toggle('advanced', settings.zAimAssist, 'Auto Z-Aim'),
        toggle('advanced', settings.alwaysRun, 'Always run'),
        toggle('advanced', settings.freelook, 'Free look'),
        range('advanced', settings.maxLostSouls, 'Max Lost Souls', 0, 50, 5),
        range('advanced', settings.timescale, 'Timescale', 0.1, 2, .1),
        option('advanced', settings.fakeContrast, 'Fake contrast', ['classic', 'gradual', 'off']),
        range('advanced', settings.fpsLimit, 'Target FPS', 5, 200, 5),
        range('advanced', settings.pixelScale, 'Pixel scale', .1, window.devicePixelRatio, .1),
        // toggle($editor.active, 'Inspector'),
        toggle('debug', settings.showStats, 'Show render stats'),
        toggle('debug', settings.showBlockMap, 'Show blockmap'),
        toggle('debug', settings.useTextures, 'Show textures'),
        option('debug', settings.monsterAI, 'AI mode', ['enabled', 'disabled', 'move-only', 'fast']),
        option('debug', settings.wireframe, 'Show geometry', ['off', 'visible', 'all']),
        // experimental
        toggle('experimental', settings.experimentalSoundHacks, 'Room accoustics (experimental)'),
    ];

    const pointerLock = createPointerLockControls();

    const audio = new AudioContext();
    return { urlHash, settings, settingsMenu, editor, audio, pointerLock };
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