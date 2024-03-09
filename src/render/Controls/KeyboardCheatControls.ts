import type { Action, ActionReturn } from 'svelte/action';
import { defaultInventory, MapRuntime, type Game, type Store, mapMusicTrack } from '../../doom';
import { allWeapons } from '../../doom/things/weapons';

export const keyboardCheatControls: Action<HTMLElement, Game> = (node, game): ActionReturn => {
    const doc = node.ownerDocument;

    let cheatStrings: CheatCode[] = [];
    function keyup(ev: KeyboardEvent) {
        let keyCode = ev.key.toLowerCase().charCodeAt(0);
        const isAlphaNumeric = (keyCode > 47 && keyCode < 58) || (keyCode > 96 && keyCode < 123);
        if (isAlphaNumeric) {
            cheatStrings.forEach(cs => cs.handleKey(ev.key));
        }
    }
    doc.addEventListener('keyup', keyup);
    const destroy = () => {
        doc.removeEventListener('keyup', keyup);
    }

    const update = (game: Game) => {
        cheatStrings = [
            new CheatCode(game, 'idclip', toggleFn(game.settings.noclip, 'No clipping mode')),
            new CheatCode(game, 'iddqd', toggleFn(game.settings.invicibility, 'No clipping mode')),
            new CheatCode(game, 'idfa', idfa),
            new CheatCode(game, 'idkfa', idkfa),
            new CheatCode(game, 'idclev??', warp),
            new CheatCode(game, 'idmus??', changeMusic),
        ];
    };
    update(game);

    return { destroy, update };
};

class CheatCode {
    private index = 0;
    private extraKeys = [];
    private keys: string[];
    constructor(private game: Game, chars: string, private fn: (game: Game, extra?: string[]) => void) {
        this.keys = chars.split('');
    }

    handleKey(key: string) {
        if (this.keys[this.index] === key) {
            this.index += 1;
        } else if (this.keys[this.index] === '?') {
            this.extraKeys.push(key);
            this.index += 1;
        } else {
            this.reset();
        }

        if (this.keys.length === this.index) {
            this.fn(this.game, this.extraKeys);
            this.reset();
        }
    }

    private reset() {
        this.index = 0;
        this.extraKeys.length = 0
    }
}

const toggleFn = (e: Store<boolean>, message: string) => (game: Game) => {
    e.set(!e.val);
    game.map.val?.player?.hudMessage?.set(message + ' ' + (e.val ? 'ON' : 'OFF'));
};

export function idkfa(game: Game) {
    game.map?.val?.player?.inventory?.update(inv => {
        inv.keys = 'byrBYR';
        return inv;
    });
    addFullAmmo(game);
    game.map.val?.player?.hudMessage?.set('Very Happy Ammo Added');
}

function addFullAmmo(game: Game) {
    const player = game.map?.val?.player;
    game.map?.val?.player?.inventory?.update(inv => {
        for (const t of Object.keys(inv.ammo)) {
            inv.ammo[t].amount = inv.ammo[t].max;
        }
        let w = [...allWeapons];
        if (!player.map.game.wad.spriteTextureData('BFGGA0')) {
            // no BFG (shareware doom?)
            w[w.findIndex(e => e.name === 'bfg')] = undefined;
        }
        if (!player.map.game.wad.spriteTextureData('PLSGA0')) {
            // no plasma rifle (shareware doom?)
            w[w.findIndex(e => e.name === 'plasma rifle')] = undefined;
        }
        if (!player.map.game.wad.spriteTextureData('SHT2A0')) {
            // no super shotgun in this wad so remove it from the weapon list
            w[w.findIndex(e => e.name === 'super shotgun')] = undefined;
        }
        inv.weapons = w;
        inv.armorType = 2;
        inv.armor = 200;
        return inv;
    });
}

export function idfa(game: Game) {
    addFullAmmo(game);
    game.map.val?.player?.hudMessage?.set('Ammo (no keys) Added');
}

function warp(game: Game, extra: string[]) {
    const mapName = game.episodic ? `E${extra[0]}M${extra[1]}` : `MAP${extra[0]}${extra[1]}`;
    if (game.wad.mapNames.includes(mapName)) {
        game.map.val?.player?.hudMessage?.set('Changing Level...');
        Object.assign(game.inventory, defaultInventory());
        game.map.set(new MapRuntime(mapName, game));
    }
}

function changeMusic(game: Game, extra: string[]) {
    const mapName = game.episodic ? `E${extra[0]}M${extra[1]}` : `MAP${extra[0]}${extra[1]}`;
    if (game.wad.mapNames.includes(mapName)) {
        game.map.val?.player?.hudMessage?.set('Music Change');
        game.map?.val?.musicTrack?.set(mapMusicTrack(game, mapName));
    } else {
        game.map.val?.player?.hudMessage?.set('IMPOSSIBLE SELECTION');
    }
}
