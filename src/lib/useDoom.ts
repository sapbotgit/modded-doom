import { getContext } from 'svelte'
import type { DoomWad } from '../doomwad';
import type { MapTextures } from './Texture';
import type { DoomGame } from '../doom-game';
import type { Writable } from 'svelte/store';

export interface DoomContext {
    game: DoomGame;
    textures: MapTextures;
    wad: DoomWad;
    editor: Writable<{
        updateThings: () => void;
        active: boolean;
        selected: any;
    }>;
    settings: {
        useTextures: boolean;
    };
}

export const useDoom = (): DoomContext => {
    return getContext<DoomContext>('doom-context')
}