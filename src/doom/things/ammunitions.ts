import type { ThingType } from ".";
import { SoundIndex } from "../doom-things-info";
import type { AmmoType, PlayerInventory, PlayerMapObject } from "../map-object";
import type { MessageId } from "../text";
import { itemPickedUp, noPickUp } from "./pickup";

export const clipAmmo: { [k in AmmoType]: number} = {
    'bullets': 10,
    'shells': 4,
    'rockets': 1,
    'cells': 20,
};

export const ammunitions: ThingType[] = [
    { type: 17,   class: 'A', onPickup: addAmmo('cells', 5, 'GOTCELLBOX'), description: 'Energy cell pack' },
    { type: 2007, class: 'A', onPickup: addAmmo('bullets', 1, 'GOTCLIP'), description: 'Clip' },
    { type: 2008, class: 'A', onPickup: addAmmo('shells', 1, 'GOTSHELLS'), description: '4 shotgun shells' },
    { type: 2010, class: 'A', onPickup: addAmmo('rockets', 1, 'GOTROCKET'), description: 'Rocket' },
    { type: 2046, class: 'A', onPickup: addAmmo('rockets', 5, 'GOTCELLBOX'), description: 'Box of rockets' },
    { type: 2047, class: 'A', onPickup: addAmmo('cells', 1, 'GOTCELL'), description: 'Energy cell' },
    { type: 2048, class: 'A', onPickup: addAmmo('bullets', 5, 'GOTCLIPBOX'), description: 'Box of bullets' },
    { type: 2049, class: 'A', onPickup: addAmmo('shells', 5, 'GOTSHELLBOX'), description: 'Box of shotgun shells' },
];

function addAmmo(type: AmmoType, clips: number, message: MessageId) {
    return (player: PlayerMapObject) => {
        let pickedUp = false;
        player.inventory.update(inv => {
            pickedUp = giveAmmo(player, inv, type, clips);
            return inv;
        });
        return pickedUp ? itemPickedUp(SoundIndex.sfx_itemup, message) : noPickUp();
    }
}

export function giveAmmo(player: PlayerMapObject, inv: PlayerInventory, type: AmmoType, clips: number) {
    // give double ammo on nightmare or easy
    const skill = player.map.game.skill
    const scalar = clips * ((skill === 1 || skill === 5) ? 2 : 1);
    if (inv.ammo[type].amount < inv.ammo[type].max) {
        const amount = clipAmmo[type] * scalar;
        inv.ammo[type].amount = Math.min(inv.ammo[type].amount + amount, inv.ammo[type].max);
        return true;
    }
    return false;
}