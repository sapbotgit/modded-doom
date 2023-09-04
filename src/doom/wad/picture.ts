import type { Color } from "three";

export type Palette = Color[];

export interface Picture {
    readonly xOffset: number,
    readonly yOffset: number,
    readonly width: number,
    readonly height: number,

    toBuffer(buffer: Uint8ClampedArray): void;
}

export class FlatPicture implements Picture {
    readonly xOffset = 0;
    readonly yOffset = 0;
    readonly width = 64;
    readonly height = 64;
    private raw: Uint8Array;

    constructor(lump: any, readonly palette: Palette) {
        this.raw = lump.contents as Uint8Array;
    }

    toBuffer(buffer: Uint8ClampedArray) {
        const size = this.width * this.height;
        for (let i = 0; i < size; i++) {
            let col = this.palette[this.raw[i]];
            buffer[i * 4 + 0] = col.r;
            buffer[i * 4 + 1] = col.g;
            buffer[i * 4 + 2] = col.b;
            buffer[i * 4 + 3] = 255;
        }
    }
}

export class LumpPicture implements Picture {
    readonly xOffset: number;
    readonly yOffset: number;
    readonly width: number;
    readonly height: number;

    private raw: Uint8Array;

    constructor(lump: any, readonly palette: Palette) {
        this.raw = lump.contents as Uint8Array;

        this.width = word(this.raw, 0);
        this.height = word(this.raw, 2);
        this.xOffset = toInt16(word(this.raw, 4));
        this.yOffset = toInt16(word(this.raw, 6));
        if (this.width > 2048 || this.height > 2048) {
            console.warn('bad pic?', lump, this.width, this.height)
        }
    }

    toBuffer(buffer: Uint8ClampedArray): void {
        this.pixels((col, x, y) => {
            let i = y * this.width + x;
            buffer[i * 4 + 0] = col.r;
            buffer[i * 4 + 1] = col.g;
            buffer[i * 4 + 2] = col.b;
            buffer[i * 4 + 3] = 255;
        });
    }

    applyPatch(buff: Uint8ClampedArray, width: number, height: number, originX: number, originY: number) {
        this.pixels((col, x, y) => {
            const u = originX + x;
            const v = originY + y;
            if (u < 0 || u >= width || v < 0 || v >= height) {
                return;
            }
            const idx = 4 * (u + v * width);
            buff[idx + 0] = col.r;
            buff[idx + 1] = col.g;
            buff[idx + 2] = col.b;
            buff[idx + 3] = 255;
        });
    }

    private pixels(fn: (col: Color, x: number, y: number) => void) {
        // Based on the "Converting from a doom picture" of https://doomwiki.org/wiki/Picture_format
        let columns = [];
        for (let i = 0; i < this.width; i++) {
            columns[i] = dword(this.raw, 8 + i * 4)
        }

        for (let i = 0; i < this.width; i++) {
            let seek = columns[i];
            for (let rowStart = this.raw[seek]; rowStart !== 255; rowStart = this.raw[seek]) {
                let pixelCount = this.raw[seek + 1];
                seek += 3; // 2 + 1 dummy byte
                for (let j = 0; j < pixelCount; j++) {
                    fn(this.palette[this.raw[seek]], i, j + rowStart);
                    seek += 1;
                }
                seek += 1; // dummy byte

                rowStart = this.raw[seek];
            }
        }
    }
}

interface Patch {
    pic: LumpPicture;
    originX: number;
    originY: number;
}

export class PatchPicture implements Picture {
    readonly xOffset = 0;
    readonly yOffset = 0;

    constructor(
        readonly width: number,
        readonly height: number,
        private patches: Patch[]) {}

    toBuffer(buffer: Uint8ClampedArray): void {
        for (const patch of this.patches) {
            patch.pic.applyPatch(buffer, this.width, this.height, patch.originX, patch.originY);
        }
    }
}

// Nifty little hack! https://stackoverflow.com/questions/50179214
const toInt16 = (num: number) => (num << 16) >> 16;
const word = (buff: Uint8Array, offset: number) => buff[offset + 1] << 8 | buff[offset];
const dword = (buff: Uint8Array, offset: number) => word(buff, offset + 2) << 16 | word(buff, offset);