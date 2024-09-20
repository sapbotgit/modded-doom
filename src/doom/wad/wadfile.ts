import KaitaiStream from 'kaitai-struct/KaitaiStream';
import DoomWadRaw from './doom-wad.ksy.ts';

export class WadFile {
    raw: any[];

    constructor(readonly name: string, buffer: ArrayBuffer) {
        const data = new DoomWadRaw(new KaitaiStream(buffer), null, null);
        this.raw = data.index;
    }

    lumpByName(name: string) {
        return this.raw.find(p => p.name === name);
    }
}