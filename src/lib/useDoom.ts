import { getContext } from 'svelte'
import type { DoomWad } from '../doomwad';
import type { MapTextures } from './Texture';
import type { DoomGame } from '../doom-game';

export interface DoomContext {
    game: DoomGame,
    textures: MapTextures,
    wad: DoomWad,
    settings: {
        useTextures: boolean;
    }
}

export const useDoom = (): DoomContext => {
  return getContext<DoomContext>('doom-context')
}