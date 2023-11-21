import type { ThingType } from '.';
import { SoundIndex } from '../doom-things-info';
import type { PlayerMapObject } from "../map-object";
import type { MessageId } from '../text';
import { itemPickedUp } from './pickup';

export const keys: ThingType[] = [
    { type: 5, class: 'K', description: 'Blue keycard', onPickup: addKey('B', 'GOTBLUECARD') },
    { type: 6, class: 'K', description: 'Yellow keycard', onPickup: addKey('Y', 'GOTYELWCARD') },
    { type: 13, class: 'K', description: 'Red keycard', onPickup: addKey('R', 'GOTREDCARD') },
    { type: 38, class: 'K', description: 'Red skull key', onPickup: addKey('r', 'GOTREDSKULL') },
    { type: 39, class: 'K', description: 'Yellow skull key', onPickup: addKey('y', 'GOTYELWSKUL') },
    { type: 40, class: 'K', description: 'Blue skull key', onPickup: addKey('b', 'GOTBLUESKUL') },
];

function addKey(key: string, message: MessageId) {
    return (player: PlayerMapObject) => {
        player.inventory.update(inv => {
            inv.keys += key;
            return inv;
        });
        // keep keys for net games
        return itemPickedUp(SoundIndex.sfx_itemup, message, player.map.game.mode === 'solo');
    };
}