import { getContext } from 'svelte'
import { MapTextures } from './Texture';
import { type DoomMap, DoomGame } from '../doom';
import { writable } from 'svelte/store';

export const createContext = (map: DoomMap) => {
    const game = new DoomGame(map);

    const editor = writable({
        active: false,
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
