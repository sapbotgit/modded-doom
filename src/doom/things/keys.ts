import type { ThingType } from '.';
import type { PlayerMapObject } from "../map-object";

const addKey = (card: string) =>
    (player: PlayerMapObject) => {
        let added = false;
        player.inventory.update(inv => {
            inv.keys += card;
            added = true;
            return inv;
        });
        // keep keys for net games
        return player.map.game.mode === 'solo' ? added : false;
    }

export const keys: ThingType[] = [
    { type: 5, class: 'K', description: 'Blue keycard', onPickup: addKey('B') },
    { type: 6, class: 'K', description: 'Yellow keycard', onPickup: addKey('Y') },
    { type: 13, class: 'K', description: 'Red keycard', onPickup: addKey('R') },
    { type: 38, class: 'K', description: 'Red skull key', onPickup: addKey('r') },
    { type: 39, class: 'K', description: 'Yellow skull key', onPickup: addKey('y') },
    { type: 40, class: 'K', description: 'Blue skull key', onPickup: addKey('b') },
];
