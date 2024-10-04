import type { LineDef } from "../map-data";
import type { Vertex } from "../math";
import type { BSPData } from "./bsp-data";
import type { Lump } from "./wadfile";

export function readBspData(mapLumps: Lump[], vertexes: Vertex[], linedefs: LineDef[]): BSPData {
    throw new Error('invalid lump: ZDoom extended nodes not yet supported');
}