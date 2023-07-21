// kind of based on p_spec.c
import type { DoomMap, LineDef } from "./Map";
import { ticksPerSecond, type DoomGame } from "./game";

// Doors
const normal = 2;
const blaze = 4 * normal;
type DoorFunction = 'openWaitClose' | 'openAndStay' | 'closeAndStay' | 'closeWaitOpen';
const doorDefinition = (type: number, trigger: string, key: 'R' | 'Y' | 'B' | 'No', speed: number, topWaitS: number, func: DoorFunction) => ({
    type,
    function: func,
    // Push, Switch, Walk, Gun (shoot)
    trigger: trigger[0] as 'P' | 'S' | 'W' | 'G',
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
    doorDefinition(196, 'SR', 'No', normal, 30, 'closeWaitOpen'),
    doorDefinition(175, 'S1', 'No', normal, 30, 'closeWaitOpen'),
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

export const createDoorAction = (game: DoomGame, map: DoomMap, linedef: LineDef) => {
    const def = doorDefinitions.find(e => e.type === linedef.special);
    if (!def) {
        console.warn('invalid door type', linedef.flags);
        return;
    }

    // TODO: use def.trigger and def.repeatable?
    // TODO: check for keys? and monsterTrigger?
    // TODO: door collision when closing? Maybe this could be done by a subscription on sector.zCeil/zFloor (to handle general moving floors/ceilings)
    // TODO: interpolate (actually, this needs to be solved in a general way for all moving things)

    const sector = linedef.left.sector;
    if (sector.specialData !== null) {
        // close->open doors should go back open, open->close doors should close, others stay the same
        if (def.function === 'closeWaitOpen') {
            sector.specialData = (sector.specialData === 0) ? 1 : -sector.specialData;
        }
        if (def.function === 'openWaitClose') {
            sector.specialData = (sector.specialData === 0) ? -1 : -sector.specialData;
        }
        return;
    }
    sector.specialData = def.function === 'openAndStay' || def.function === 'openWaitClose' ? 1 : -1;

    const topHeight = def.type === 16 || def.type === 76
        ? sector.values.zCeil
        : (map.sectorNeighbours(sector).reduce((last, sec) => Math.min(last, sec.values.zCeil), Infinity) - 4);
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
};
