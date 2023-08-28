import { getContext } from 'svelte'
import { MapTextures, type RenderSector } from './RenderData';
import { Game, MapRuntime } from '../doom';
import { writable } from 'svelte/store';

export const createContext = (game: Game) => {
    const editor = writable({
        active: false,
        selected: null,
    });
    const textures = new MapTextures(game.wad);
    const settings = {
        targetFPS: 120,
        useTextures: true,
    };
    const wad = game.wad;
    return { game, wad, textures, editor, settings };
}

export const useDoom = (): ReturnType<typeof createContext> => {
    return getContext('doom-context')
}

export const useDoomMap = (): { map: MapRuntime, renderSectors: RenderSector[] } => {
    return getContext('doom-map');
}