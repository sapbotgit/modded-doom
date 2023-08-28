import { type ThingType } from '.';
import type { AmmoType, PlayerMapObject } from "../map-object";
import { clipAmmo, giveAmmo } from './ammunitions';
import { updateInventory } from './items';

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
            return true;
        }
    },
    { type: 2011, class: 'P', description: 'Stimpack', onPickup: addhealth(10) },
    { type: 2012, class: 'P', description: 'Medikit', onPickup: addhealth(25) },
    { type: 2018, class: 'P', description: 'Armor',
        onPickup: (player: PlayerMapObject) => {
            let changed = false;
            player.inventory.update(inv => {
                if (inv.armor < 100) {
                    inv.armor = 100;
                    changed = true;
                }
                return inv;
            });
            return changed;
        },
    },
    { type: 2019, class: 'P', description: 'Megaarmor', onPickup: updateInventory(inv => inv.armor = 200) },
    { type: 2025, class: 'P', description: 'Radiation shielding suit', onPickup: updateInventory(inv => inv.items.radiationSuitTicks = 30 * 35) },
];


function addhealth(amount: number) {
    return (player: PlayerMapObject) => {
        let added = false;
        player.health.update(health => {
            if (health < 100) {
                health = Math.min(100, health + amount);
                added = true;
            }
            return health;
        })
        return added;
    }
}
