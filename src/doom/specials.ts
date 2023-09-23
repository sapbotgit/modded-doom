// kind of based on p_spec.c
import { MapObject, PlayerMapObject } from "./map-object";
import { ToRadians, lineAABB, randInt } from "./math";
import { MFFlags, MapObjectIndex, StateIndex } from "./doom-things-info";
import type { MapRuntime } from "./map-runtime";
import { type LineDef, type Sector } from "./map-data";

// TODO: this whole thing could be a fun candidate for refactoring. I honestly think we could write
// all this stuff in a much cleaner way but first step would be to add some unit tests and then get to it!

// General
export function triggerSpecial(mobj: MapObject, linedef: LineDef, trigger: TriggerType, side: -1 | 1) {
    if (linedef.special === 9) {
        return donut(mobj, linedef, trigger, side);
    }
    return (
        createDoorAction(mobj, linedef, trigger) ??
        createLiftAction(mobj, linedef, trigger) ??
        createFloorAction(mobj, linedef, trigger) ??
        createCeilingAction(mobj, linedef, trigger) ??
        createCrusherCeilingAction(mobj, linedef, trigger) ??
        createLightingAction(mobj, linedef, trigger) ??
        applyTeleportAction(mobj, linedef, trigger, side) ??
        createRisingStairAction(mobj, linedef, trigger)
    );
}

// Push, Switch, Walk, Gun (shoot)
export type TriggerType = 'P' | 'S' | 'W' | 'G';
const ticksPerSecond = 35;
const floorMax = 32000;
export interface SpecialDefinition {
    repeatable: boolean;
}

type TargetValueFunction = (map: MapRuntime, sector: Sector) => number;

const findLowestCeiling = (map: MapRuntime, sector: Sector) =>
    map.data.sectorNeighbours(sector).reduce((last, sec) => Math.min(last, sec.zCeil.val), floorMax)
const lowestNeighbourFloor = (map: MapRuntime, sector: Sector) =>
    map.data.sectorNeighbours(sector).reduce((last, sec) => Math.min(last, sec.zFloor.val), sector.zFloor.val);
const highestNeighbourFloor = (map: MapRuntime, sector: Sector) =>
    map.data.sectorNeighbours(sector).reduce((last, sec) => Math.max(last, sec.zFloor.val), -floorMax);
const nextNeighbourFloor = (map: MapRuntime, sector: Sector) =>
    map.data.sectorNeighbours(sector).reduce((last, sec) => sec.zFloor.val > sector.zFloor.val ? Math.min(last, sec.zFloor.val) : last, floorMax);
const lowestNeighbourCeiling = (map: MapRuntime, sector: Sector) =>
    map.data.sectorNeighbours(sector).reduce((last, sec) => Math.min(last, sec.zCeil.val), sector.zCeil.val);
const highestNeighbourCeiling = (map: MapRuntime, sector: Sector) =>
    map.data.sectorNeighbours(sector).reduce((last, sec) => Math.max(last, sec.zCeil.val), -floorMax);
const floorHeight = (map: MapRuntime, sector: Sector) => sector.zFloor.val;

const shortestLowerTexture = (map: MapRuntime, sector: Sector) => {
    let target = floorMax;
    for (const ld of map.data.linedefs) {
        if (ld.left?.sector === sector) {
            const rtx = map.game.wad.wallTextureData(ld.right.lower.val);
            const ltx = map.game.wad.wallTextureData(ld.left.lower.val);
            target = Math.min(target,
                    (typeof ltx === 'object' ? ltx.height : Infinity),
                    (typeof rtx === 'object' ? rtx.height : Infinity));
        }
    }
    return sector.zFloor.val + target;
};
const floorValue = (map: MapRuntime, sector: Sector) => sector.zFloor.val;
const adjust = (fn: TargetValueFunction, change: number) => (map: MapRuntime, sector: Sector) => fn(map, sector) + change;

type SectorSelectorFunction = (map: MapRuntime, sector: Sector, linedef: LineDef) => Sector;
const selectNum = (map: MapRuntime, sector: Sector) => {
    let line: LineDef = null;
    for (const ld of map.data.linedefs) {
        if (ld.flags & 0x0004) {
            if (ld.left.sector === sector && ld.right.sector.zFloor.val === sector.zFloor.val) {
                line = (line && line.num < ld.num) ? line : ld;
            }
        }
    }
    return line ? line.right.sector : sector;
}

const selectTrigger = (map: MapRuntime, sector: Sector, linedef: LineDef) => {
    return (!linedef.left || sector === linedef.left.sector) ? linedef.right.sector : linedef.left.sector;
}

// effects
type EffectFunction = (map: MapRuntime, sector: Sector, linedef: LineDef) => void;
type SectorEffectFunction = (map: MapRuntime, from: Sector, to: Sector) => void;
const effect = (effects: SectorEffectFunction[], select: SectorSelectorFunction) =>
    (map: MapRuntime, to: Sector, linedef: LineDef) => {
        const from = select(map, to, linedef);
        effects.forEach(ef => ef(map, from, to))
    };

const assignFloorFlat = (map: MapRuntime, from: Sector, to: Sector) => {
    to.floorFlat.set(from.floorFlat.val);
    map.initializeTextureAnimation(to.floorFlat, 'flat');
}

const assignSectorType = (map: MapRuntime, from: Sector, to: Sector) => {
    to.type = from.type;
}

const zeroSectorType = (map: MapRuntime, from: Sector, to: Sector) => {
    to.type = 0;
}

const sectorObjects = (map: MapRuntime, sector: Sector) => {
    // find all objects that are in the sector (mobj.sector === sector) or
    // they are on the edge (intercepting a two sided linedef)
    const linedefs = map.data.linedefs.filter(ld => ld.right.sector === sector || ld.left?.sector === sector);

    // figure out sector bounds from linedef vertexes
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const linedef of linedefs) {
        minX = Math.min(linedef.v[0].x, linedef.v[1].x, minX);
        maxX = Math.max(linedef.v[0].x, linedef.v[1].x, maxX);
        minY = Math.min(linedef.v[0].y, linedef.v[1].y, minY);
        maxY = Math.max(linedef.v[0].y, linedef.v[1].y, maxY);
    }

    const mobjs = [];
    const twoSided = linedefs.filter(ld => ld.flags & 0x0004);
    map.data.blockmap.traceBounds(minX, minY, maxX, maxY, block => {
        for (const mobj of block.things) {
            // add any objects that have their center in the sector
            if (mobj.sector.val === sector) {
                mobjs.push(mobj);
                continue;
            }

            // check if the object overlaps with any two sided linedef for the sector
            // (ie. half in this sector and half in another)
            for (const ld of twoSided) {
                const hit = lineAABB(ld.v, mobj.position.val, mobj.info.radius);
                if (hit) {
                    mobjs.push(mobj);
                    break;
                }
            }
        }
    });
    return mobjs;
}

const isBeingCrushed = (mobj: MapObject, zFloor: number, zCeil: number ) =>
    (zCeil - zFloor) < mobj.info.height;

function crunchMapObject(mobj: MapObject) {
    if (mobj.info.flags & MFFlags.MF_DROPPED) {
        // dropped items get destroyed
        mobj.map.destroy(mobj);
        return;
    }

    if (mobj.health.val <= 0) {
        // crunch any bodies into blood pools
        mobj.setState(StateIndex.S_GIBS);
        mobj.info.flags &= ~MFFlags.MF_SOLID;
        mobj.info.height = 0;
        mobj.info.radius = 0;
    }
}

function crunchAndDamageMapObject(mobj: MapObject) {
    crunchMapObject(mobj);
    if ((mobj.info.flags & MFFlags.MF_SHOOTABLE) && (mobj.map.game.time.tick.val & 3) === 0) {
        mobj.damage(10, null, null);
        // spray blood
        const pos = mobj.position.val;
        const blood = mobj.map.spawn(MapObjectIndex.MT_BLOOD, pos.x, pos.y, pos.z + mobj.info.height * .5);
        blood.velocity.set(
            randInt(-255, 255) * 0.0625,
            randInt(-255, 255) * 0.0625,
            0);
    }
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

export const createDoorAction = (mobj: MapObject, linedef: LineDef, trigger: TriggerType): SpecialDefinition | undefined => {
    const map = mobj.map;
    const def = doorDefinitions.find(e => e.type === linedef.special);
    if (!def) {
        console.warn('invalid door type', linedef.special);
        return;
    }
    const validTrigger = (
        // We treat P === S but P has the distinction of not needing a sector tag (it's a local door)
        (trigger === 'S' && def.trigger === 'P')
        || def.trigger === trigger
    )
    if (!validTrigger) {
        return;
    }
    if (!def.repeatable) {
        linedef.special = 0; // one time action so clear special
    }
    if (mobj.isMonster && !def.monsterTrigger) {
        return;
    }
    const missingKey = def.key && mobj instanceof PlayerMapObject && !mobj.inventory.val.keys.toUpperCase().includes(def.key);
    if (missingKey) {
        return;
    }

    // TODO: interpolate (actually, this needs to be solved in a general way for all moving things)

    let triggered = false;
    const sectors = def.trigger === 'P' ? [linedef.left.sector] : map.data.sectors.filter(e => e.tag === linedef.tag)
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
            ? sector.zCeil.val : (findLowestCeiling(map, sector) - 4);
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
                let original = ceil;
                ceil += def.speed * sector.specialData;

                // crush (and reverse direction)
                if (sector.specialData === -1) {
                    const mobjs = sectorObjects(map, sector).filter(mobj => isBeingCrushed(mobj, sector.zFloor.val, ceil));
                    if (mobjs.length) {
                        mobjs.forEach(crunchMapObject);
                        // force door to open
                        sector.specialData = 1;
                        return original;
                    }
                }

                let finished = false;
                if (ceil > topHeight) {
                    // hit ceiling
                    finished = def.function === 'closeWaitOpen' || def.function === 'openAndStay';
                    ticks = def.topWait;
                    ceil = topHeight;
                    sector.specialData = 0;
                } else if (ceil < sector.zFloor.val) {
                    // hit floor
                    finished = def.function === 'openWaitClose' || def.function === 'closeAndStay';
                    ticks = def.topWait;
                    ceil = sector.zFloor.val;
                    sector.specialData = 0;
                }

                if (finished) {
                    map.removeAction(action);
                    sector.specialData = null;
                }
                return ceil;
            });
        };
        map.addAction(action);
    }

    return triggered ? def : undefined;
};

// Lifts
const liftDefinition = (type: number, trigger: string, waitTimeS: number, speed: number, direction: number, targetHighFn: TargetValueFunction, actionType: 'normal' | 'perpetual' | 'stop' = 'normal', effect?: EffectFunction) => ({
    type,
    trigger: trigger[0] as TriggerType,
    repeatable: (trigger[1] === 'R'),
    speed,
    direction,
    effect,
    perpetual: actionType === 'perpetual',
    targetHighFn,
    stopper: actionType === 'stop',
    monsterTrigger: trigger.includes('m'),
    waitTime: waitTimeS * ticksPerSecond,
});

// Some combination of the unofficial doom spec https://www.gamers.org/dhs/helpdocs/dmsp1666.html
// and doomwiki https://doomwiki.org/wiki/Linedef_type#Platforms_.28lifts.29
// Note doomwiki categorizes some floor movements as "lifts" while the doom spec calls them moving floors
const slow = 4;
const fast = 2 * slow;
const liftDefinitions = [
    liftDefinition(14, 'S1', 0, .5, 1, adjust(floorValue, 32), 'normal', effect([assignFloorFlat, zeroSectorType], selectTrigger)),
    liftDefinition(15, 'S1', 0, .5, 1, adjust(floorValue, 24), 'normal', effect([assignFloorFlat], selectTrigger)),
    liftDefinition(20, 'S1', 0, .5, 1, nextNeighbourFloor, 'normal', effect([assignFloorFlat, zeroSectorType], selectTrigger)),
    liftDefinition(22, 'W1', 0, .5, 1, nextNeighbourFloor, 'normal', effect([assignFloorFlat, zeroSectorType], selectTrigger)),
    liftDefinition(47, 'G1', 0, .5, 1, nextNeighbourFloor, 'normal', effect([assignFloorFlat, zeroSectorType], selectTrigger)),
    liftDefinition(66, 'SR', 0, 0.5, 1, adjust(floorValue, 24), 'normal', effect([assignFloorFlat], selectTrigger)),
    liftDefinition(67, 'SR', 0, 0.5, 1, adjust(floorValue, 32), 'normal', effect([assignFloorFlat, zeroSectorType], selectTrigger)),
    liftDefinition(68, 'SR', 0, 0.5, 1, nextNeighbourFloor, 'normal', effect([assignFloorFlat, zeroSectorType], selectTrigger)),
    liftDefinition(95, 'WR', 0, 0.5, 1, nextNeighbourFloor, 'normal', effect([assignFloorFlat, zeroSectorType], selectTrigger)),
    liftDefinition(54, 'W1', 0, 0, 0, floorValue, 'stop'),
    liftDefinition(89, 'WR', 0, 0, 0, floorValue, 'stop'),
    liftDefinition(10, 'W1m', 3, 4, -1, floorValue),
    liftDefinition(21, 'S1', 3, 4, -1, floorValue),
    liftDefinition(53, 'SR', 3, 1, -1, highestNeighbourFloor, 'perpetual'),
    liftDefinition(62, 'SR', 3, 4, -1, floorValue),
    liftDefinition(87, 'WR', 3, 1, -1, highestNeighbourFloor, 'perpetual'),
    liftDefinition(88, 'WRm', 3, 4, -1, floorValue),
    liftDefinition(120, 'WR', 3, 8, -1, floorValue),
    liftDefinition(121, 'W1', 3, 8, -1, floorValue),
    liftDefinition(122, 'S1', 3, 8, -1, floorValue),
    liftDefinition(123, 'SR', 3, 8, -1, floorValue),
];

export const createLiftAction = ( mobj: MapObject, linedef: LineDef, trigger: TriggerType): SpecialDefinition | undefined => {
    const map = mobj.map;
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
    if (mobj.isMonster && !def.monsterTrigger) {
        return;
    }

    let triggered = false;
    const sectors = map.data.sectors.filter(e => e.tag === linedef.tag);
    for (const sector of sectors) {
        if (def.stopper || sector.specialData !== null) {
            if (def.stopper) {
                map.removeAction(sector.specialData);
            } else {
                map.addAction(sector.specialData);
            }
            // sector is already running an action so don't add another one
            continue;
        }

        triggered = true;

        const low = lowestNeighbourFloor(map, sector);
        const high = def.targetHighFn(map, sector);

        if (def.direction > 0) {
            def.effect?.(map, sector, linedef);
        }

        let ticks = 0;
        let direction = def.direction;
        const action = () => {
            if (ticks) {
                ticks--;
                return;
            }

            let finished = false;
            // move lift
            sector.zFloor.update(val => {
                val += def.speed * direction;

                if (val < low) {
                    // hit bottom
                    ticks = def.waitTime;
                    val = low;
                    direction = 1;
                } else if (val > high) {
                    // hit top
                    finished = !def.perpetual;
                    ticks = def.waitTime;
                    val = high;
                    direction = -1;
                }
                return val;
            });

            if (finished) {
                map.removeAction(action);
                sector.specialData = null;
                if (def.direction < 0) {
                    def.effect?.(map, sector, linedef);
                }
            }
        };
        sector.specialData = action;
        map.addAction(action);
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

export const createFloorAction = (mobj: MapObject, linedef: LineDef,  trigger: TriggerType): SpecialDefinition | undefined => {
    const map = mobj.map;
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
    if (mobj.isMonster) {
        return;
    }

    let triggered = false;
    const sectors = map.data.sectors.filter(e => e.tag === linedef.tag);
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
            // SND: sfx_stnmov (leveltime&7)

            sector.zFloor.update(val => {
                let original = val;
                val += def.direction;

                // crush
                if (def.direction === 1) {
                    const crunch = def.crush ? crunchAndDamageMapObject : crunchMapObject;
                    const mobjs = sectorObjects(map, sector).filter(mobj => isBeingCrushed(mobj, val, sector.zCeil.val));
                    if (mobjs.length) {
                        mobjs.forEach(crunch);
                        return original;
                    }
                }

                if ((def.direction > 0 && val > target) || (def.direction < 0 && val < target)) {
                    // SND: sfx_pstop
                    finished = true;
                    val = target;
                }

                return val;
            });

            if (finished) {
                sector.specialData = null;
                map.removeAction(action);
                if (def.direction < 0) {
                    def.effect?.(map, sector, linedef);
                }
            }
        }
        map.addAction(action);
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

export const createCeilingAction = (mobj: MapObject, linedef: LineDef, trigger: TriggerType): SpecialDefinition | undefined => {
    const map = mobj.map;
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
    if (mobj.isMonster) {
        return;
    }

    let triggered = false;
    const sectors = map.data.sectors.filter(e => e.tag === linedef.tag);
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
                let original = val;
                val += def.speed * def.direction;

                // crush
                if (def.direction === 1) {
                    const mobjs = sectorObjects(map, sector).filter(mobj => isBeingCrushed(mobj, val, sector.zCeil.val));
                    if (mobjs.length) {
                        mobjs.forEach(crunchMapObject);
                        return original;
                    }
                }

                if ((def.direction > 0 && val > target) || (def.direction < 0 && val < target)) {
                    finished = true;
                    val = target;
                }

                return val;
            });

            if (finished) {
                sector.specialData = null;
                map.removeAction(action);
            }
        }
        map.addAction(action);
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

export const createCrusherCeilingAction = (mobj: MapObject, linedef: LineDef, trigger: TriggerType): SpecialDefinition | undefined => {
    const map = mobj.map;
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
    if (mobj.isMonster) {
        return;
    }

    let triggered = false;
    const sectors = map.data.sectors.filter(e => e.tag === linedef.tag);
    for (const sector of sectors) {
        // NOTE: E3M4 has an interesting behaviour in the outdoor room because a sector has only 1 special data.
        // If you start the crusher before flipping the switch, you cannot flip the switch to get the bonus items.
        // gzDoom actually handles this but chocolate doom (and I assume the original) did not
        if (def.stopper || sector.specialData !== null) {
            if (def.stopper) {
                map.removeAction(sector.specialData);
            } else {
                map.addAction(sector.specialData);
            }
            continue;
        }

        triggered = true;

        let direction = def.direction;
        const top = sector.zCeil.val;
        const bottom = def.targetFn(map, sector);
        const action = () => {
            let finished = false;

            sector.zCeil.update(val => {
                let original = val;
                val += def.speed * direction;

                // crush
                if (def.direction === -1) {
                    const mobjs = sectorObjects(map, sector).filter(mobj => isBeingCrushed(mobj, sector.zFloor.val, val));
                    if (mobjs.length) {
                        mobjs.forEach(crunchAndDamageMapObject);
                        if (def.speed === ceilingSlow) {
                            // slow crushers go even slowing when they crush something
                            val = original + (def.speed / 8) * direction
                        }
                    }
                }

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
        map.addAction(action);
    }
    return triggered ? def : undefined;
};

// Lighting
const setLightLevel = (val: number) =>
    (map: MapRuntime, sec: Sector) => val;
const maxNeighbourLight = (map: MapRuntime, sector: Sector) =>
    map.data.sectorNeighbours(sector).reduce((last, sec) => Math.max(last, sec.light.val), 0);
const minNeighbourLight = (map: MapRuntime, sector: Sector) =>
    map.data.sectorNeighbours(sector).reduce((last, sec) => Math.min(last, sec.light.val), 255);
export const lowestLight = (sectors: Sector[], max: number) =>
    sectors.reduce((last, sec) => Math.min(last, sec.light.val), max);

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

export const createLightingAction = (mobj: MapObject, linedef: LineDef, trigger: TriggerType): SpecialDefinition | undefined => {
    const map = mobj.map;
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
    if (mobj.isMonster) {
        return;
    }

    let triggered = false;
    let targetValue = -1;
    const sectors = map.data.sectors.filter(e => e.tag === linedef.tag);
    for (const sector of sectors) {
        if (def.type === 17) {
            // As far as I can tell, type 17 is only used in tnt 09. It's extra special
            map.addAction(strobeFlash(5, 35)(map, sector));
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
    (map: MapRuntime, sector: Sector) => {
        const max = sector.light.initial;
        const nearestMin = lowestLight(map.data.sectorNeighbours(sector), max);
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

const randomFlicker = (map: MapRuntime, sector: Sector) => {
    const max = sector.light.initial;
    const min = lowestLight(map.data.sectorNeighbours(sector), max);
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

const glowLight = (map: MapRuntime, sector: Sector) => {
    const max = sector.light.initial;
    const min = lowestLight(map.data.sectorNeighbours(sector), max);
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

const fireFlicker = (map: MapRuntime, sector: Sector) => {
    const max = sector.light.initial;
    const min = lowestLight(map.data.sectorNeighbours(sector), max) + 16;
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

export const sectorLightAnimations = {
    1: randomFlicker,
    2: strobeFlash(5, 15),
    3: strobeFlash(5, 35),
    4: strobeFlash(5, 35),
    8: glowLight,
    12: strobeFlash(5, 35, true),
    13: strobeFlash(5, 15, true),
    17: fireFlicker,
};

// Teleports
const createTeleportDefinition = (type: number, trigger: string) => ({
    type,
    trigger: trigger[0] as TriggerType,
    repeatable: (trigger[1] === 'R'),
    movePlayer: (type === 97 || type === 39),
    monsterTrigger: true,
});

const teleportDefinitions = [
    createTeleportDefinition(39, 'W1'),
    createTeleportDefinition(97, 'WR'),
    createTeleportDefinition(126, 'WR'),
    createTeleportDefinition(125, 'W1'),
];

export const applyTeleportAction = (mobj: MapObject, linedef: LineDef, trigger: TriggerType, side: -1 | 1): SpecialDefinition | undefined => {
    if (side === 1) {
        // don't triggering teleports when leaving the teleport space
        return;
    }
    const map = mobj.map;
    const def = teleportDefinitions.find(e => e.type === linedef.special);
    if (!def) {
        console.warn('invalid teleport special', linedef.special);
        return;
    }
    if (def.trigger !== trigger) {
        return;
    }
    if (!def.repeatable) {
        linedef.special = 0;
    }
    if (mobj.isMonster && !def.monsterTrigger) {
        return;
    }
    if (mobj instanceof PlayerMapObject && !def.movePlayer) {
        return;
    }

    let triggered = false;
    const teleports = map.data.things.filter(e => e.type === 14)
    for (const tp of teleports) {
        let sector = map.data.findSector(tp.x, tp.y);

        // TODO: for monster teleports, check space is blocked

        if (sector.tag === linedef.tag) {
            // teleport fog in old and new locations
            const pos = mobj.position.val;
            map.spawn(MapObjectIndex.MT_TFOG, pos.x, pos.y);
            const dir = tp.angle * ToRadians;
            map.spawn(MapObjectIndex.MT_TFOG, tp.x + 20 * Math.cos(dir), tp.y + 20 * Math.sin(dir));

            mobj.teleport(tp, sector);
            triggered = true;
            break;
        }
    }
    return triggered ? def : undefined;
};

// Donut (apparently only in E1M2 and E2M2 and map21 of tnt (none in Doom2 or plutonia)
export const donut = (mobj: MapObject, linedef: LineDef, trigger: TriggerType, side: -1 | 1): SpecialDefinition | undefined => {
    const map = mobj.map;
    const def = { trigger: 'S', repeatable: false };
    if (trigger !== def.trigger) {
        return;
    }
    if (!def.repeatable) {
        linedef.special = 0;
    }
    if (mobj.isMonster) {
        return;
    }

    let triggered = false;
    const speed = 0.5;
    const sectors = map.data.sectors.filter(e => e.tag === linedef.tag);
    for (const pillar of sectors) {
        if (pillar.specialData !== null) {
            continue;
        }
        triggered = true;

        const donut = map.data.sectorNeighbours(pillar)[0];
        const model = map.data.sectorNeighbours(donut).filter(e => e !== pillar)[0];
        const target = model.zFloor.val;

        pillar.specialData = def;
        const pillarAction = () => {
            let finished = false;

            pillar.zFloor.update(val => {
                val += -speed;

                if (val < target) {
                    finished = true;
                    val = target;
                }

                return val;
            });

            if (finished) {
                pillar.specialData = null;
                map.removeAction(pillarAction);
            }
        };
        map.addAction(pillarAction);

        donut.specialData = def;
        const donutAction = () => {
            let finished = false;

            donut.zFloor.update(val => {
                val += speed;

                if (val > target) {
                    finished = true;
                    val = target;
                }

                return val;
            });

            if (finished) {
                assignFloorFlat(map, model, donut);
                assignSectorType(map, model, donut);
                donut.specialData = null;
                map.removeAction(donutAction);
            }
        };
        map.addAction(donutAction);
    }
    return triggered ? def : undefined;
};

// Rising Stairs
const risingStarDefinition = (type: number, trigger: string, speed: number, stepSize: number) => ({
    type,
    trigger: trigger[0] as TriggerType,
    repeatable: (trigger[1] === 'R'),
    direction: 1,
    stepSize,
    speed,
});

const risingStairs = [
    risingStarDefinition(7, 'S1', .25, 8),
    risingStarDefinition(8, 'W1', .25, 8),
    risingStarDefinition(127, 'S1', 4, 16),
    risingStarDefinition(100, 'W1', 4, 16),
];

export const createRisingStairAction = (mobj: MapObject, linedef: LineDef, trigger: TriggerType): SpecialDefinition | undefined => {
    const map = mobj.map;
    const def = risingStairs.find(e => e.type === linedef.special);
    if (!def) {
        console.warn('invalid riser special', linedef.special);
        return;
    }
    if (def.trigger !== trigger) {
        return;
    }
    if (!def.repeatable) {
        linedef.special = 0;
    }
    if (mobj.isMonster) {
        return;
    }

    let triggered = false;
    const sectors = map.data.sectors.filter(e => e.tag === linedef.tag);
    for (const sector of sectors) {
        if (sector.specialData !== null) {
            continue;
        }

        triggered = true;
        let target = sector.zFloor.val;

        const flat = sector.floorFlat.val;
        let base = sector;
        while (base) {
            target += def.stepSize;
            raiseFloorAction(map, base, def, target);

            // find next step to raise
            const matches = map.data.sectorNeighbours(base)
                .filter(e => e.floorFlat.val === flat && e.specialData === null);
            base = matches.length ? matches[0] : null;
        }
    }
    return triggered ? def : undefined;
};

function raiseFloorAction(map: MapRuntime, sector: Sector, def: { speed: number, direction: number }, target: number) {
    sector.specialData = def;
    const action = () => {
        let finished = false;

        sector.zFloor.update(val => {
            val += def.direction * def.speed;

            if (val > target) {
                finished = true;
                val = target;
            }

            return val;
        });

        if (finished) {
            sector.specialData = null;
            map.removeAction(action);
        }
    }
    map.addAction(action);
}