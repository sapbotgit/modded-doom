// import * as fs from 'fs';
// import KaitaiStream from 'kaitai-struct/KaitaiStream.js';
// import DoomWad from './doom-wad.ksy.js';
import wadjs from "wad-js";

const wad = new wadjs.Wad('../doom.wad');
let mapData = new wadjs.MapData(wad, "E1M1")
console.log(mapData)