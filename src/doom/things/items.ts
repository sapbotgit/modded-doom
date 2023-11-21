import { type ThingType } from '.';
import { SoundIndex } from '../doom-things-info';
import { ticksPerSecond } from '../game';
import type { PlayerInventory, PlayerMapObject } from "../map-object";
import type { MessageId } from '../text';
import { itemPickedUp } from './pickup';

// kind of a stray observation but the names "items" and "powerups" feel reversed to me. I'm taking them from
// https://doomwiki.org/wiki/Thing_types but these items all use the sfx_getpow sound while most powerulps use
// the sfx_itemup sound. Not important but I'm always a little confused
export const items: ThingType[] = [
    { type: 83, class: 'I', description: 'Megasphere',
        onPickup: (player: PlayerMapObject) => {
            player.health.set(200);
            player.inventory.update(inv => {
                inv.armor = 200;
                return inv;
            });
            return itemPickedUp(SoundIndex.sfx_getpow, 'GOTMSPHERE');
        }
    },
    { type: 2013, class: 'I', description: 'Supercharge', onPickup: addhealth(100, SoundIndex.sfx_getpow, 'GOTSUPER') },
    { type: 2014, class: 'I', description: 'Health bonus', onPickup: addhealth(1, SoundIndex.sfx_itemup, 'GOTHTHBONUS') },
    { type: 2015, class: 'I', description: 'Armor bonus', onPickup: updateInventory('GOTARMBONUS', inv => inv.armor = Math.min(200, inv.armor + 1)) },
    { type: 2022, class: 'I', description: 'Invulnerability', onPickup: updateInventory('GOTINVUL', inv => inv.items.invincibilityTicks = 30 * ticksPerSecond) },
    { type: 2023, class: 'I', description: 'Berserk',
        onPickup: (player: PlayerMapObject) => {
            player.inventory.update(inv => {
                inv.items.berserkTicks = 30 * ticksPerSecond;
                inv.items.berserk = true;
                return inv;
            });
            // switch to fists
            player.nextWeapon = player.inventory.val.weapons[1];
            return itemPickedUp(SoundIndex.sfx_getpow, 'GOTBERSERK');
        },
    },
    { type: 2024, class: 'I', description: 'Partial invisibility', onPickup: updateInventory('GOTINVIS', inv => inv.items.invisibilityTicks = 30 * ticksPerSecond) },
    { type: 2026, class: 'I', description: 'Computer area map', onPickup: updateInventory('GOTMAP', inv => inv.items.computerMap = true) },
    { type: 2045, class: 'I', description: 'Light amplification visor', onPickup: updateInventory('GOTVISOR', inv => inv.items.nightVisionTicks = 30 * ticksPerSecond) },
];

function addhealth(amount: number, sound: SoundIndex, message: MessageId) {
    return (player: PlayerMapObject) => {
        player.health.update(health => {
            health = Math.min(200, health + amount);
            return health;
        });
        return itemPickedUp(sound, message);
    }
}

export function updateInventory(message: MessageId, fn: (inv: PlayerInventory) => void) {
    return (player: PlayerMapObject) => {
        player.inventory.update(inv => {
            fn(inv);
            return inv;
        });
        return itemPickedUp(SoundIndex.sfx_getpow, message);
    }
}