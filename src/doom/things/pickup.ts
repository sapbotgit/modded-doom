import { SoundIndex } from "../doom-things-info";
import type { MapObject, PlayerMapObject } from "../map-object";
import type { MessageId } from "../text";

// common pickup functions
type PickupResult = {
    message: MessageId;
    sound: SoundIndex;
    removeMapObject: boolean;
}
export type PickupFunction = (player: PlayerMapObject, mobj: MapObject) => PickupResult;

const _itemPickedUp: PickupResult = { message: 'GOTARMBONUS', sound: SoundIndex.sfx_getpow, removeMapObject: false };
export function itemPickedUp(sound: SoundIndex, messege: MessageId, removeItem = true ): PickupResult {
    _itemPickedUp.removeMapObject = removeItem;
    _itemPickedUp.sound = sound;
    _itemPickedUp.message = messege;
    return _itemPickedUp;
}

export function noPickUp(): PickupResult {
    return null;
}