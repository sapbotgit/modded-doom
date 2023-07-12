import { getContext } from 'svelte'
import type { DoomMap } from '../doomwad';
import { MapTextures } from './Texture';
import { DoomGame } from '../doom-game';
import { writable, type Writable } from 'svelte/store';

export const createContext = (map: DoomMap) => {
    const game = new DoomGame(map);

    const editor = writable({
        updateThings: () => map.objs = map.objs,
        active: true,
        selected: null,
    });
    const textures = new MapTextures(map.wad);
    const settings = {
        targetFPS: 120,
        useTextures: true,
    };
    const wad = map.wad;

    return { game, textures, editor, settings, wad };
}

export const useDoom = (): ReturnType<typeof createContext> => {
    return getContext('doom-context')
}
