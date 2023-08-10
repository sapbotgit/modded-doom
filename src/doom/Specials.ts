// kind of based on p_spec.c
import { get } from "svelte/store";
import type { DoomMap, LineDef, Sector } from "./Map";
import type { MapObject } from "./MapObject";
import { type DoomGame } from "./game";
import { randInt } from "./Math";

// General
// Push, Switch, Walk, Gun (shoot)
export type TriggerType = 'P' | 'S' | 'W' | 'G';
const ticksPerSecond = 35;
const floorMax = 32000;
export interface SpecialDefinition {
    repeatable: boolean;
}

type TargetValueFunction = (map: DoomMap, sector: Sector) => number;

const findLowestCeiling = (map: DoomMap, sector: Sector) =>
    map.sectorNeighbours(sector).reduce((last, sec) => Math.min(last, sec.values.zCeil), floorMax)
const lowestNeighbourFloor = (map: DoomMap, sector: Sector) =>
    map.sectorNeighbours(sector).reduce((last, sec) => Math.min(last, sec.values.zFloor), sector.values.zFloor);
const highestNeighbourFloor = (map: DoomMap, sector: Sector) =>
    map.sectorNeighbours(sector).reduce((last, sec) => Math.max(last, sec.values.zFloor), -floorMax);
const nextNeighbourFloor = (map: DoomMap, sector: Sector) =>
    map.sectorNeighbours(sector).reduce((last, sec) => sec.values.zFloor > sector.values.zFloor ? Math.min(last, sec.values.zFloor) : last, floorMax);
const lowestNeighbourCeiling = (map: DoomMap, sector: Sector) =>
    map.sectorNeighbours(sector).reduce((last, sec) => Math.min(last, sec.values.zCeil), sector.values.zCeil);
const highestNeighbourCeiling = (map: DoomMap, sector: Sector) =>
    map.sectorNeighbours(sector).reduce((last, sec) => Math.max(last, sec.values.zCeil), -floorMax);
const floorHeight = (map: DoomMap, sector: Sector) => sector.values.zFloor;

const shortestLowerTexture = (map: DoomMap, sector: Sector) => {
    let target = floorMax;
    for (const ld of map.linedefs) {
        if (ld.left?.sector === sector) {
            // TODO: get and wallTextureData are both a little expensive (esp wallTexturedata), can we do better?
            const rname = get(ld.right.lower);
            const rtx = map.wad.wallTextureData(rname);
            const lname = get(ld.left.lower);
            const ltx = map.wad.wallTextureData(lname);
            target = Math.min(target,
                    (ltx && 'height' in ltx ? ltx.height : Infinity),
                    (rtx && 'height' in rtx ? rtx.height : Infinity));
        }
    }
    return sector.values.zFloor + target;
};
const floorValue = (map: DoomMap, sector: Sector) => sector.values.zFloor;
const adjust = (fn: TargetValueFunction, change: number) => (map: DoomMap, sector: Sector) => fn(map, sector) + change;

type SectorSelectorFunction = (map: DoomMap, sector: Sector, linedef: LineDef) => Sector;
const selectNum = (map: DoomMap, sector: Sector) => {
    let line: LineDef = null;
    for (const ld of map.linedefs) {
        if (ld.flags & 0x0004) {
            if (ld.left.sector === sector && ld.right.sector.values.zFloor === sector.values.zFloor) {
                line = (line && line.num < ld.num) ? line : ld;
            }
        }
    }
    return line ? line.right.sector : sector;
}

const selectTrigger = (map: DoomMap, sector: Sector, linedef: LineDef) => {
    return (linedef.left.sector === sector) ? linedef.right.sector : linedef.left.sector;
}

// effects
type EffectFunction = (map: DoomMap, sector: Sector, linedef: LineDef) => void;
type SectorEffectFunction = (from: Sector, to: Sector) => void;
const effect = (effects: SectorEffectFunction[], select: SectorSelectorFunction) =>
    (map: DoomMap, to: Sector, linedef: LineDef) => {
        const from = select(map, to, linedef);
        effects.forEach(ef => ef(from, to))
    };

const assignFloorFlat = (from: Sector, to: Sector) => {
    to.floorFlat = from.floorFlat;
    to.rev.update(rev => ++rev);
}

const assignSectorType = (from: Sector, to: Sector) => {
    // not need to update rev because the UI doesn't depend on it
    to.type = from.type;
}

// Doors
const normal = 2;
const blaze = 4 * normal;
type DoorFunction = 'openWaitClose' | 'openAndStay' | 'closeAndStay' | 'closeWaitOpen';
const doorDefinition = (type: number, trigger: string, key: 'R' | 'Y' | 'B' | 'No', speed: number, topWaitS: number, func: DoorFunction) => ({
    type,
    function: func,
    trigger: trigger[0] as TriggerType,
    repeatable: (trigger[1] === 'R'),
    speed,
    key: key === 'No' ? undefined : key,
    topWait: topWaitS * ticksPerSecond,
    monsterTrigger: type === 1,
});

// https://doomwiki.org/wiki/Linedef_type#Door_linedef_types
const doorDefinitions = [
    doorDefinition(1, 'PR', 'No', normal, 4, 'openWaitClose'),
    doorDefinition(117, 'PR', 'No', blaze, 4, 'openWaitClose'),
    doorDefinition(63, 'SR', 'No', normal, 4, 'openWaitClose'),
    doorDefinition(114, 'SR', 'No', blaze, 4, 'openWaitClose'),
    doorDefinition(29, 'S1', 'No', normal, 4, 'openWaitClose'),
    doorDefinition(111, 'S1', 'No', blaze, 4, 'openWaitClose'),
    doorDefinition(90, 'WR', 'No', normal, 4, 'openWaitClose'),
    doorDefinition(105, 'WR', 'No', blaze, 4, 'openWaitClose'),
    doorDefinition(4, 'W1', 'No', normal, 4, 'openWaitClose'),
    doorDefinition(108, 'W1', 'No', blaze, 4, 'openWaitClose'),
    doorDefinition(31, 'P1', 'No', normal, -1, 'openAndStay'),
    doorDefinition(118, 'P1', 'No', blaze, -1, 'openAndStay'),
    doorDefinition(61, 'SR', 'No', normal, -1, 'openAndStay'),
    doorDefinition(115, 'SR', 'No', blaze, -1, 'openAndStay'),
    doorDefinition(103, 'S1', 'No', normal, -1, 'openAndStay'),
    doorDefinition(112, 'S1', 'No', blaze, -1, 'openAndStay'),
    doorDefinition(86, 'WR', 'No', normal, -1, 'openAndStay'),
    doorDefinition(106, 'WR', 'No', blaze, -1, 'openAndStay'),
    doorDefinition(2, 'W1', 'No', normal, -1, 'openAndStay'),
    doorDefinition(109, 'W1', 'No', blaze, -1, 'openAndStay'),
    doorDefinition(46, 'GR', 'No', normal, -1, 'openAndStay'),
    doorDefinition(42, 'SR', 'No', normal, -1, 'closeAndStay'),
    doorDefinition(116, 'SR', 'No', blaze, -1, 'closeAndStay'),
    doorDefinition(50, 'S1', 'No', normal, -1, 'closeAndStay'),
    doorDefinition(113, 'S1', 'No', blaze, -1, 'closeAndStay'),
    doorDefinition(75, 'WR', 'No', normal, -1, 'closeAndStay'),
    doorDefinition(107, 'WR', 'No', blaze, -1, 'closeAndStay'),
    doorDefinition(3, 'W1', 'No', normal, -1, 'closeAndStay'),
    doorDefinition(110, 'W1', 'No', blaze, -1, 'closeAndStay'),
    doorDefinition(76, 'WR', 'No', normal, 30, 'closeWaitOpen'),
    doorDefinition(16, 'W1', 'No', normal, 30, 'closeWaitOpen'),
    // Key doors
    doorDefinition(26, 'PR', 'B', normal, 4, 'openWaitClose'),
    doorDefinition(28, 'PR', 'R', normal, 4, 'openWaitClose'),
    doorDefinition(27, 'PR', 'Y', normal, 4, 'openWaitClose'),
    doorDefinition(32, 'P1', 'B', normal, 1, 'openAndStay'),
    doorDefinition(33, 'P1', 'R', normal, -1, 'openAndStay'),
    doorDefinition(34, 'P1', 'Y', normal, -1, 'openAndStay'),
    doorDefinition(99, 'SR', 'B', blaze, -1, 'openAndStay'),
    doorDefinition(134, 'SR', 'R', blaze, -1, 'openAndStay'),
    doorDefinition(136, 'SR', 'Y', blaze, -1, 'openAndStay'),
    doorDefinition(133, 'S1', 'B', blaze, -1, 'openAndStay'),
    doorDefinition(135, 'S1', 'R', blaze, -1, 'openAndStay'),
    doorDefinition(137, 'S1', 'Y', blaze, -1, 'openAndStay'),
];

export const createDoorAction = (game: DoomGame, map: DoomMap, linedef: LineDef, mobj: MapObject, trigger: TriggerType): SpecialDefinition | undefined => {
    const def = doorDefinitions.find(e => e.type === linedef.special);
    if (!def) {
        console.warn('invalid door type', linedef.special);
        return;
    }
    const validTrigger = (
        // We P === S but P has the distinction of not needing a sector tag (it's a local door)
        (trigger === 'S' && def.trigger === 'P')
        || def.trigger === trigger
    )
    if (!validTrigger) {
        return;
    }
    if (!def.repeatable) {
        linedef.special = 0; // one time action so clear special
    }

    // TODO: check for keys? and monsterTrigger?
    // TODO: door collision when closing? Maybe this could be done by a subscription on sector.zCeil/zFloor (to handle general moving floors/ceilings)
    // TODO: interpolate (actually, this needs to be solved in a general way for all moving things)

    let triggered = false;
    const sectors = def.trigger === 'P' ? [linedef.left.sector] : map.sectors.filter(e => e.tag === linedef.tag)
    for (const sector of sectors) {
        if (sector.specialData !== null) {
            if (def.trigger === 'P') {
                // push doors can be interrupted:
                // close->open doors should go back open
                // open->close doors should close
                // other types continue along
                if (def.function === 'closeWaitOpen') {
                    sector.specialData = (sector.specialData === 0) ? 1 : -sector.specialData;
                }
                if (def.function === 'openWaitClose') {
                    sector.specialData = (sector.specialData === 0) ? -1 : -sector.specialData;
                }
            }
            continue;
        }
        triggered = true;
        sector.specialData = def.function === 'openAndStay' || def.function === 'openWaitClose' ? 1 : -1;

        const topHeight = def.type === 16 || def.type === 76
            ? sector.values.zCeil : (findLowestCeiling(map, sector) - 4);
        let ticks = 0;
        const action = () => {
            if (sector.specialData === 0) {
                // waiting
                if (ticks--) {
                    return;
                }
                if (def.function === 'closeWaitOpen' || def.function === 'openWaitClose') {
                    sector.specialData = def.function === 'openWaitClose' ? -1 : 1;
                }
                return;
            }

            // move door
            sector.zCeil.update(ceil => {
                ceil += def.speed * sector.specialData;

                let finished = false;
                if (ceil > topHeight) {
                    // hit ceiling
                    finished = def.function === 'closeWaitOpen' || def.function === 'openAndStay';
                    ticks = def.topWait;
                    ceil = topHeight;
                    sector.specialData = 0;
                } else if (ceil < sector.values.zFloor) {
                    // hit floor
                    finished = def.function === 'openWaitClose' || def.function === 'closeAndStay';
                    ticks = def.topWait;
                    ceil = sector.values.zFloor;
                    sector.specialData = 0;
                }

                if (finished) {
                    game.removeAction(action);
                    sector.specialData = null;
                }
                return ceil;
            });
        };
        game.addAction(action);
    }

    return triggered ? def : undefined;
};

// Lifts
const liftDefinition = (type: number, trigger: string, waitTimeS: number, speed: number) => ({
    type,
    trigger: trigger[0] as TriggerType,
    repeatable: (trigger[1] === 'R'),
    speed,
    monsterTrigger: trigger.includes('m'),
    waitTime: waitTimeS * ticksPerSecond,
});

// Some combination of the unofficial doom spec https://www.gamers.org/dhs/helpdocs/dmsp1666.html
// and doomwiki https://doomwiki.org/wiki/Linedef_type#Platforms_.28lifts.29
// Note doomwiki categorizes some floor movements as "lifts" while the doom spec calls them moving floors
const slow = 4;
const fast = 2 * slow;
const liftDefinitions = [
    liftDefinition(62, 'SR', 3, slow),
    liftDefinition(21, 'S1', 3, slow),
    liftDefinition(88, 'WRm', 3, slow),
    liftDefinition(10, 'W1m', 3, slow),
    liftDefinition(123, 'SR', 3, fast),
    liftDefinition(122, 'S1', 3, fast),
    liftDefinition(120, 'WR', 3, fast),
    liftDefinition(121, 'W1', 3, fast),
];

export const createLiftAction = (game: DoomGame, map: DoomMap, linedef: LineDef, mobj: MapObject, trigger: TriggerType): SpecialDefinition | undefined => {
    const def = liftDefinitions.find(e => e.type === linedef.special);
    if (!def) {
        console.warn('invalid lift type', linedef.special);
        return;
    }
    if (def.trigger !== trigger) {
        return;
    }
    if (!def.repeatable) {
        linedef.special = 0;
    }

    let triggered = false;
    const sectors = map.sectors.filter(e => e.tag === linedef.tag);
    for (const sector of sectors) {
        if (sector.specialData !== null) {
            // sector is already running an action so don't add another one
            continue;
        }

        triggered = true;
        sector.specialData = -1;

        const low = lowestNeighbourFloor(map, sector);
        const high = sector.values.zFloor;

        let ticks = 0;
        const action = () => {
            if (sector.specialData === 0) {
                // waiting
                if (ticks--) {
                    return;
                }
                sector.specialData = 1;
                return;
            }

            // move lift
            sector.zFloor.update(val => {
                val += def.speed * sector.specialData;

                let finished = false;
                if (val < low) {
                    // hit bottom
                    ticks = def.waitTime;
                    val = low;
                    sector.specialData = 0;
                } else if (val > high) {
                    // hit top
                    finished = true;
                    ticks = def.waitTime;
                    val = high;
                    sector.specialData = 0;
                }

                if (finished) {
                    game.removeAction(action);
                    sector.specialData = null;
                }
                return val;
            });
        };
        game.addAction(action);
    }
    return triggered ? def : undefined;
};

// Floors
const floorDefinition = (type: number, trigger: string, direction: number, speed: number, effect: EffectFunction, crush: boolean, targetFn: TargetValueFunction) => ({
    type,
    trigger: trigger[0] as TriggerType,
    repeatable: (trigger[1] === 'R'),
    direction,
    effect,
    crush,
    targetFn,
    speed,
});

const floorDefinitions = [
    floorDefinition(23, 'S1', -1, slow, null, false, lowestNeighbourFloor),
    floorDefinition(60, 'SR', -1, slow, null, false, lowestNeighbourFloor),
    floorDefinition(82, 'WR', -1, slow, null, false, lowestNeighbourFloor),
    floorDefinition(38, 'W1', -1, slow, null, false, lowestNeighbourFloor),
    floorDefinition(84, 'WR', -1, slow, effect([assignFloorFlat, assignSectorType], selectNum), false, lowestNeighbourFloor),
    floorDefinition(37, 'W1', -1, slow, effect([assignFloorFlat, assignSectorType], selectNum), false, lowestNeighbourFloor),
    floorDefinition(69, 'SR', 1, slow, null, false, nextNeighbourFloor),
    floorDefinition(18, 'S1', 1, slow, null, false, nextNeighbourFloor),
    floorDefinition(128, 'WR', 1, slow, null, false, nextNeighbourFloor),
    floorDefinition(119, 'W1', 1, slow, null, false, nextNeighbourFloor),
    floorDefinition(132, 'SR', 1, fast, null, false, nextNeighbourFloor),
    floorDefinition(131, 'S1', 1, fast, null, false, nextNeighbourFloor),
    floorDefinition(129, 'WR', 1, fast, null, false, nextNeighbourFloor),
    floorDefinition(130, 'W1', 1, fast, null, false, nextNeighbourFloor),
    floorDefinition(64, 'SR', 1, slow, null, false, lowestNeighbourCeiling),
    floorDefinition(101, 'S1', 1, slow, null,  false, lowestNeighbourCeiling),
    floorDefinition(91, 'WR', 1, slow, null, false, lowestNeighbourCeiling),
    floorDefinition(5, 'W1', 1, slow, null, false, lowestNeighbourCeiling),
    floorDefinition(24, 'G1', 1, slow, null, false, lowestNeighbourCeiling),
    floorDefinition(65, 'SR', 1, slow, null, true, adjust(lowestNeighbourCeiling, -8)),
    floorDefinition(55, 'S1', 1, slow, null, true, adjust(lowestNeighbourCeiling, -8)),
    floorDefinition(94, 'WR', 1, slow, null, true, adjust(lowestNeighbourCeiling, -8)),
    floorDefinition(56, 'W1', 1, slow, null, true, adjust(lowestNeighbourCeiling, -8)),
    floorDefinition(45, 'SR', -1, slow, null,  false, highestNeighbourFloor),
    floorDefinition(102, 'S1', -1, slow, null, false, highestNeighbourFloor),
    floorDefinition(83, 'WR', -1, slow, null,  false, highestNeighbourFloor),
    floorDefinition(19, 'W1', -1, slow, null,  false, highestNeighbourFloor),
    floorDefinition(70, 'SR', -1, fast, null,  false, adjust(highestNeighbourFloor, 8)),
    floorDefinition(71, 'S1', -1, fast, null,  false, adjust(highestNeighbourFloor, 8)),
    floorDefinition(98, 'WR', -1, fast, null,  false, adjust(highestNeighbourFloor, 8)),
    floorDefinition(36, 'W1', -1, fast, null,  false, adjust(highestNeighbourFloor, 8)),
    floorDefinition(92, 'WR', 1, slow, null, false, adjust(floorValue, 24)),
    floorDefinition(58, 'W1', 1, slow, null, false, adjust(floorValue, 24)),
    floorDefinition(93, 'WR', 1, slow, effect([assignFloorFlat, assignSectorType], selectTrigger),  false, adjust(floorValue, 24)),
    floorDefinition(59, 'W1', 1, slow, effect([assignFloorFlat, assignSectorType], selectTrigger),  false, adjust(floorValue, 24)),
    floorDefinition(96, 'WR', 1, slow, null, false, shortestLowerTexture),
    floorDefinition(30, 'W1', 1, slow, null, false, shortestLowerTexture),
    floorDefinition(140, 'S1', 1, slow, null, false, adjust(floorValue, 512)),
];

export const createFloorAction = (game: DoomGame, map: DoomMap, linedef: LineDef, mobj: MapObject, trigger: TriggerType): SpecialDefinition | undefined => {
    const def = floorDefinitions.find(e => e.type === linedef.special);
    if (!def) {
        console.warn('invalid floor special', linedef.special);
        return;
    }
    if (def.trigger !== trigger) {
        return;
    }
    if (!def.repeatable) {
        linedef.special = 0;
    }

    // TODO: crushing?

    let triggered = false;
    const sectors = map.sectors.filter(e => e.tag === linedef.tag);
    for (const sector of sectors) {
        if (sector.specialData !== null) {
            continue;
        }

        triggered = true;
        if (def.direction > 0) {
            def.effect?.(map, sector, linedef);
        }

        sector.specialData = def.direction;
        const target = def.targetFn(map, sector);
        const action = () => {
            let finished = false;

            sector.zFloor.update(val => {
                val += def.direction;

                if ((def.direction > 0 && val > target) || (def.direction < 0 && val < target)) {
                    finished = true;
                    val = target;
                }

                return val;
            });

            if (finished) {
                sector.specialData = null;
                game.removeAction(action);
                if (def.direction < 0) {
                    def.effect?.(map, sector, linedef);
                }
            }
        }
        game.addAction(action);
    }
    return triggered ? def : undefined;
};

// Ceilings
const ceilingSlow = 1;
const ceilingFast = ceilingSlow * 2;
const ceilingDefinition = (type: number, trigger: string, direction: number, speed: number, targetFn: TargetValueFunction) => ({
    type,
    trigger: trigger[0] as TriggerType,
    repeatable: (trigger[1] === 'R'),
    direction,
    targetFn,
    speed,
});

const ceilingDefinitions = [
    ceilingDefinition(40, 'W1', 1, ceilingSlow, highestNeighbourCeiling),
    ceilingDefinition(41, 'S1', -1, ceilingFast, floorHeight),
    ceilingDefinition(43, 'SR', -1, ceilingFast, floorHeight),
    ceilingDefinition(44, 'W1', -1, ceilingSlow, adjust(floorHeight, 8)),
    ceilingDefinition(72, 'WR', -1, ceilingSlow, adjust(floorHeight, 8)),
];

export const createCeilingAction = (game: DoomGame, map: DoomMap, linedef: LineDef, mobj: MapObject, trigger: TriggerType): SpecialDefinition | undefined => {
    const def = ceilingDefinitions.find(e => e.type === linedef.special);
    if (!def) {
        console.warn('invalid ceiling special', linedef.special);
        return;
    }
    if (def.trigger !== trigger) {
        return;
    }
    if (!def.repeatable) {
        linedef.special = 0;
    }

    // TODO: crushing?

    let triggered = false;
    const sectors = map.sectors.filter(e => e.tag === linedef.tag);
    for (const sector of sectors) {
        if (sector.specialData !== null) {
            continue;
        }

        triggered = true;

        sector.specialData = def.direction;
        const target = def.targetFn(map, sector);
        const action = () => {
            let finished = false;

            sector.zCeil.update(val => {
                val += def.speed * def.direction;

                if ((def.direction > 0 && val > target) || (def.direction < 0 && val < target)) {
                    finished = true;
                    val = target;
                }

                return val;
            });

            if (finished) {
                sector.specialData = null;
                game.removeAction(action);
            }
        }
        game.addAction(action);
    }
    return triggered ? def : undefined;
};

// Crusher Ceilings
const crusherCeilingDefinition = (type: number, trigger: string, speed: number, triggerType: 'start' | 'stop') => ({
    type,
    trigger: trigger[0] as TriggerType,
    repeatable: (trigger[1] === 'R'),
    direction: -1,
    silent: type === 141 ? true : false,
    targetFn: adjust(floorHeight, 8),
    stopper: triggerType === 'stop',
    speed,
});

const crusherCeilingDefinitions = [
    crusherCeilingDefinition(49, 'S1', ceilingSlow, 'start'),
    crusherCeilingDefinition(73, 'WR', ceilingSlow, 'start'),
    crusherCeilingDefinition(25, 'W1', ceilingSlow, 'start'),
    crusherCeilingDefinition(77, 'WR', ceilingFast, 'start'),
    crusherCeilingDefinition(6, 'W1', ceilingFast, 'start'),
    crusherCeilingDefinition(141, 'W1', ceilingSlow, 'start'),
    crusherCeilingDefinition(74, 'WR', null, 'stop'),
    crusherCeilingDefinition(57, 'W1', null, 'stop'),
];

export const createCrusherCeilingAction = (game: DoomGame, map: DoomMap, linedef: LineDef, mobj: MapObject, trigger: TriggerType): SpecialDefinition | undefined => {
    const def = crusherCeilingDefinitions.find(e => e.type === linedef.special);
    if (!def) {
        console.warn('invalid crusher special', linedef.special);
        return;
    }
    if (def.trigger !== trigger) {
        return;
    }
    if (!def.repeatable) {
        linedef.special = 0;
    }

    // TODO: actually damage things (like barrels, monsters, and players)
    // TODO: slow down when crushing? (not for fast crushers though...)

    let triggered = false;
    const sectors = map.sectors.filter(e => e.tag === linedef.tag);
    for (const sector of sectors) {
        // NOTE: E3M4 has an interesting behaviour in the outdoor room because a sector has only 1 special data.
        // If you start the crusher before flipping the switch, you cannot flip the switch to get the bonus items.
        // gzDoom actually handles this but chocolate doom (and I assume the original) did not
        if (def.stopper || sector.specialData !== null) {
            if (def.stopper) {
                game.removeAction(sector.specialData);
            } else {
                game.addAction(sector.specialData);
            }
            continue;
        }

        triggered = true;

        let direction = def.direction;
        const top = sector.values.zCeil;
        const bottom = def.targetFn(map, sector);
        const action = () => {
            let finished = false;

            sector.zCeil.update(val => {
                val += def.speed * direction;

                if (val < bottom) {
                    finished = true;
                    val = bottom;
                }
                if (val > top) {
                    finished = true;
                    val = top;
                }

                return val;
            });

            if (finished) {
                // crushers keep going
                direction = -direction;
            }
        };
        sector.specialData = action;
        game.addAction(action);
    }
    return triggered ? def : undefined;
};

// Lighting
const setLightLevel = (val: number) =>
    (map: DoomMap, sec: Sector) => val;
const maxNeighbourLight = (map: DoomMap, sector: Sector) =>
    map.sectorNeighbours(sector).reduce((last, sec) => Math.max(last, sec.values.light), 0);
const minNeighbourLight = (map: DoomMap, sector: Sector) =>
    map.sectorNeighbours(sector).reduce((last, sec) => Math.min(last, sec.values.light), 255);
export const lowestLight = (sectors: Sector[], max: number) =>
    sectors.reduce((last, sec) => Math.min(last, sec.values.light), max);

const createLightingDefinition = (type: number, trigger: string, targetValueFn: TargetValueFunction) => ({
    type,
    trigger: trigger[0] as TriggerType,
    repeatable: (trigger[1] === 'R'),
    targetValueFn,
});

const lightingDefinitions = [
    createLightingDefinition(12, 'W1', maxNeighbourLight),
    createLightingDefinition(80, 'WR', maxNeighbourLight),
    createLightingDefinition(104, 'W1', minNeighbourLight),
    createLightingDefinition(17, 'W1', null),
    createLightingDefinition(35, 'W1', setLightLevel(35)),
    createLightingDefinition(79, 'WR', setLightLevel(35)),
    createLightingDefinition(139, 'SR',setLightLevel(35)),
    createLightingDefinition(13, 'W1', setLightLevel(255)),
    createLightingDefinition(81, 'WR', setLightLevel(255)),
    createLightingDefinition(138, 'SR', setLightLevel(255)),
];

export const createLightingAction = (game: DoomGame, map: DoomMap, linedef: LineDef, mobj: MapObject, trigger: TriggerType): SpecialDefinition | undefined => {
    const def = lightingDefinitions.find(e => e.type === linedef.special);
    if (!def) {
        console.warn('invalid light special', linedef.special);
        return;
    }
    if (def.trigger !== trigger) {
        return;
    }
    if (!def.repeatable) {
        linedef.special = 0;
    }

    let triggered = false;
    let targetValue = -1;
    const sectors = map.sectors.filter(e => e.tag === linedef.tag);
    for (const sector of sectors) {
        if (def.type === 17) {
            // As far as I can tell, type 17 is only used in tnt 09. It's extra special
            game.addAction(strobeFlash(5, 35)(map, sector));
        } else {
            if (targetValue === -1) {
                targetValue = def.targetValueFn(map, sector);
            }
            sector.light.set(targetValue);
        }
        triggered = true;
    }
    return triggered ? def : undefined;
};

const strobeFlash =
    (lightTicks: number, darkTicks: number, synchronized = false) =>
    (map: DoomMap, sector: Sector) => {
        const max = sector.source.light;
        const nearestMin = lowestLight(map.sectorNeighbours(sector), max);
        const min = (nearestMin === max) ? 0 : nearestMin;
        let ticks = synchronized ? 1 : randInt(1, 7);
        return () => {
            if (--ticks) {
                return;
            }
            sector.light.update(val => {
                if (val === max) {
                    ticks = darkTicks;
                    return min;
                } else {
                    ticks = lightTicks;
                    return max;
                }
            });
        };
    };

const randomFlicker = (map: DoomMap, sector: Sector) => {
    const max = sector.source.light;
    const min = lowestLight(map.sectorNeighbours(sector), max);
    let ticks = 1;
    return () => {
        if (--ticks) {
            return;
        }
        sector.light.update(val => {
            if (val === max) {
                ticks = randInt(1, 7);
                return min;
            } else {
                ticks = randInt(1, 64);
                return max;
            }
        });
    };
};

const glowLight = (map: DoomMap, sector: Sector) => {
    const max = sector.source.light;
    const min = lowestLight(map.sectorNeighbours(sector), max);
    let step = -8;
    return () => sector.light.update(val => {
        val += step;
        if (val <= min || val >= max) {
            step = -step;
            val += step;
        }
        return val;
    });
};

const fireFlicker = (map: DoomMap, sector: Sector) => {
    const max = sector.source.light;
    const min = lowestLight(map.sectorNeighbours(sector), max) + 16;
    let ticks = 4;
    return () => {
        if (--ticks) {
            return;
        }
        ticks = 4;
        const amount = randInt(0, 2) * 16;
        sector.light.set(Math.max(max - amount, min));
    }
};

export const sectorAnimations = {
    1: randomFlicker,
    2: strobeFlash(5, 15),
    3: strobeFlash(5, 35),
    4: strobeFlash(5, 35),
    8: glowLight,
    12: strobeFlash(5, 35, true),
    13: strobeFlash(5, 15, true),
    17: fireFlicker,
};
