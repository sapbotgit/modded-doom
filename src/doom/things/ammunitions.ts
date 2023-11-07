import type { ThingType } from ".";
import type { AmmoType, PlayerInventory, PlayerMapObject } from "../map-object";

export const clipAmmo: { [k in AmmoType]: number} = {
    'bullets': 10,
    'shells': 4,
    'rockets': 1,
    'cells': 20,
};

export const ammunitions: ThingType[] = [
    { type: 17, class: 'A', description: 'Energy cell pack', onPickup: addAmmo('cells', 5) },
    { type: 2007, class: 'A', description: 'Clip', onPickup: addAmmo('bullets', 1) },
    { type: 2008, class: 'A', description: '4 shotgun shells', onPickup: addAmmo('shells', 1) },
    { type: 2010, class: 'A', description: 'Rocket', onPickup: addAmmo('rockets', 1) },
    { type: 2046, class: 'A', description: 'Box of rockets', onPickup: addAmmo('rockets', 5) },
    { type: 2047, class: 'A', description: 'Energy cell', onPickup: addAmmo('cells', 1) },
    { type: 2048, class: 'A', description: 'Box of bullets', onPickup: addAmmo('bullets', 5) },
    { type: 2049, class: 'A', description: 'Box of shotgun shells', onPickup: addAmmo('shells', 5) },
];

function addAmmo(type: keyof PlayerInventory['ammo'], clips: number) {
    return (player: PlayerMapObject) => {
        let added = false;
        player.inventory.update(inv => {
            added = giveAmmo(player, inv, type, clips);
            return inv;
        });
        return added;
    }
}

export function giveAmmo(player: PlayerMapObject, inv: PlayerInventory, type: keyof PlayerInventory['ammo'], clips: number) {
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