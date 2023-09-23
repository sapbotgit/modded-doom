import { type ThingType } from '.';
import type { PlayerInventory, PlayerMapObject } from "../map-object";

export const items: ThingType[] = [
    { type: 83, class: 'I', description: 'Megasphere',
        onPickup: (player: PlayerMapObject) => {
            player.health.set(200);
            player.inventory.update(inv => {
                inv.armor = 200;
                return inv;
            });
            return true;
        }
    },
    { type: 2013, class: 'I', description: 'Supercharge', onPickup: addhealth(100) },
    { type: 2014, class: 'I', description: 'Health bonus', onPickup: addhealth(1) },
    { type: 2015, class: 'I', description: 'Armor bonus', onPickup: updateInventory(inv => inv.armor = Math.min(200, inv.armor + 1)) },
    { type: 2022, class: 'I', description: 'Invulnerability', onPickup: updateInventory(inv => inv.items.invincibilityTicks = 30 * 35) },
    { type: 2023, class: 'I', description: 'Berserk', onPickup: updateInventory(inv => inv.items.berserkTicks = 30 * 35) },
    { type: 2024, class: 'I', description: 'Partial invisibility', onPickup: updateInventory(inv => inv.items.invisibilityTicks = 30 * 35) },
    { type: 2026, class: 'I', description: 'Computer area map', onPickup: updateInventory(inv => inv.items.computerMap = true) },
    { type: 2045, class: 'I', description: 'Light amplification visor', onPickup: updateInventory(inv => inv.items.nightVisionTicks = 30 * 35) },
];

function addhealth(amount: number) {
    return (player: PlayerMapObject) => {
        player.health.update(health => {
            health = Math.min(200, health + amount);
            return health;
        })
        return true;
    }
}

export function updateInventory(fn: (inv: PlayerInventory) => void) {
    return (player: PlayerMapObject) => {
        player.inventory.update(inv => {
            fn(inv);
            return inv;
        });
        return true;
    }
}