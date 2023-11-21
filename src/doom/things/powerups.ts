import { type ThingType } from '.';
import { SoundIndex } from '../doom-things-info';
import type { AmmoType, PlayerMapObject } from "../map-object";
import type { MessageId } from '../text';
import { clipAmmo, giveAmmo } from './ammunitions';
import { updateInventory } from './items';
import { itemPickedUp, noPickUp } from './pickup';

export const powerups: ThingType[] = [
    { type: 8, class: 'P', description: 'Backpack',
        onPickup: (player: PlayerMapObject) => {
            player.inventory.update(inv => {
                inv.ammo.bullets.max = 400;
                inv.ammo.shells.max = 100;
                inv.ammo.rockets.max = 100;
                inv.ammo.cells.max = 600;

                Object.keys(clipAmmo).forEach((type: AmmoType) => giveAmmo(player, inv, type, 1));
                return inv;
            });
            return itemPickedUp(SoundIndex.sfx_itemup, 'GOTBACKPACK');
        }
    },
    { type: 2011, class: 'P', description: 'Stimpack', onPickup: addhealth(10, 'GOTSTIM') },
    { type: 2012, class: 'P', description: 'Medikit', onPickup: addhealth(25, 'GOTMEDIKIT', 'GOTMEDINEED') },
    { type: 2018, class: 'P', description: 'Armor', onPickup: giveArmor(100, 1) },
    { type: 2019, class: 'P', description: 'Megaarmor', onPickup: giveArmor(200, 2) },
    { type: 2025, class: 'P', description: 'Radiation shielding suit', onPickup: updateInventory('GOTSUIT', inv => inv.items.radiationSuitTicks = 30 * 35) },
];

function giveArmor(amount: number, type: 1 | 2) {
    return (player: PlayerMapObject) => {
        let pickedUp = false;
        player.inventory.update(inv => {
            let units = amount * type;
            if (inv.armor < units) {
                pickedUp = true;
                inv.armorType = type;
                inv.armor = amount;
            }
            return inv;
        });
        return pickedUp
            ? itemPickedUp(SoundIndex.sfx_itemup, type === 2 ? 'GOTMEGA' : 'GOTARMOR')
            : noPickUp();
    };
}

function addhealth(amount: number, message: MessageId, lowHealthMessage?: MessageId) {
    return (player: PlayerMapObject) => {
        let pickedUp = false;
        const msg = player.health.val < 25 ? (lowHealthMessage ?? message) : message;
        player.health.update(health => {
            if (health < 100) {
                health = Math.min(100, health + amount);
                pickedUp = true;
            }
            return health;
        });
        return pickedUp
            ? itemPickedUp(SoundIndex.sfx_itemup, msg)
            : noPickUp();
    }
}
