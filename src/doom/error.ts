// A standard error class to help the UI show meaningful error messages
import { Game } from "../doom";

interface BaseDoomError {
    code: number;
    message: string;
    details: any;
}

export interface InvalidMap extends BaseDoomError {
    code: 1;
    details: {
        game: Game,
        mapName: string;
        exception: Error,
    },
}

export interface MissingMap extends BaseDoomError {
    code: 2
    details: {
        game: Game,
        mapName: string;
    },
}

export interface MissingWads extends BaseDoomError {
    code: 3;
    details: {
        succeededWads: string[];
        failedWads: [string, Error][];
    },
}

export interface GameLogicFailure extends BaseDoomError {
    code: 4;
    details: {
        game: Game,
        exception: Error,
    },
}

export type DoomError = InvalidMap | MissingMap | MissingWads | GameLogicFailure;