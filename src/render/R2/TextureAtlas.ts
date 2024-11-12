import { DataTexture, FloatType, NearestFilter, RepeatWrapping, SRGBColorSpace } from "three";
import type { DoomWad, Picture } from "../../doom";


function findNearestPower2(n: number) {
    let t = 1;
    while (t < n) {
        t *= 2;
    }
    return t;
}

type RowEdge = { x: number, y: number, rowHeight: number };

export class TextureAtlas {
    index: DataTexture;
    texture: DataTexture;
    private textures = new Map<string, [number, Picture]>();
    private flats = new Map<string, [number, Picture]>();

    private count = 0;

    constructor(private wad: DoomWad, private maxSize: number) {}

    // actually builds the texture atlas and index
    commit() {
        const textures = [...this.textures.values(), ...this.flats.values()];
        const size = findNearestPower2(textures.length);
        const tAtlas = new DataTexture(new Float32Array((size * size) * 4), size, size);
        tAtlas.type = FloatType;
        tAtlas.needsUpdate = true;
        this.index = tAtlas;

        // My iPhone XR says max texture size is 16K but if I do that, the webview uses 1GB of RAM and immediately crashes.
        // 8K is still 256MB RAM but apparently it's okay so have a hard coded limit here
        for (const tSize of [1024, 2048, 4096, 8192]) {
            if (tSize > this.maxSize) {
                break;
            }

            const packing = packTextures(textures, tSize);
            if (packing) {
                const texture = new DataTexture(new Uint8ClampedArray(tSize * tSize * 4).fill(0), tSize, tSize);
                texture.wrapS = RepeatWrapping;
                texture.wrapT = RepeatWrapping;
                texture.magFilter = NearestFilter;
                texture.colorSpace = SRGBColorSpace;
                texture.needsUpdate = true;
                this.texture = texture;

                for (const tx of packing) {
                    tx.pic.toAtlasBuffer(this.texture.image.data, tSize, tx.x, tx.y);

                    this.index.image.data[0 + tx.idx * 4] = tx.x / tSize;
                    this.index.image.data[1 + tx.idx * 4] = tx.y / tSize;
                    this.index.image.data[2 + tx.idx * 4] = (tx.x + tx.pic.width) / tSize;
                    this.index.image.data[3 + tx.idx * 4] = (tx.y + tx.pic.height) / tSize;
                }
                return;
            }
        }
        throw new Error(`cannot build texture atlas with ${[this.maxSize, textures.length]}`);
    }

    // animations cause jank after map load as the different frames are loaded into the atlas.
    // So we store the texture names that are part of animations and if one is loaded, we load the rest
    wallTexture(name: string): [number, Picture] {
        let data = this.textures.get(name);
        if (!data) {
            const pic = this.wad.wallTextureData(name);
            data = this.insertTexture(pic);
            this.textures.set(name, data);

            if (this.wad.animatedWalls.has(name)) {
                // load the rest of the animation frames
                for (const frame of this.wad.animatedWalls.get(name).frames) {
                    if (frame === name) {
                        continue;
                    }
                    const pic = this.wad.wallTextureData(frame);
                    this.textures.set(frame, this.insertTexture(pic));
                }
            }
        }
        return data;
    }

    private insertTexture = (pic: Picture): [number, Picture] => [this.count++, pic];

    flatTexture(name: string): [number, Picture] {
        let data = this.flats.get(name);
        if (!data) {
            const pic = this.wad.flatTextureData(name);
            data = this.insertTexture(pic);
            this.flats.set(name, data);

            if (this.wad.animatedFlats.has(name)) {
                // load the rest of the animation frames
                for (const frame of this.wad.animatedFlats.get(name).frames) {
                    if (frame === name) {
                        continue;
                    }
                    const pic = this.wad.flatTextureData(frame);
                    this.flats.set(frame, this.insertTexture(pic));
                }
            }
        }
        return data;
    }
}

// Cool background I found while trying to improve this: https://www.david-colson.com/2020/03/10/exploring-rect-packing.html
// My function is similar to the "row splitter" with a few extra heuristics for splitting rows
type PackInfo = { idx: number, pic: Picture, x: number, y: number };
function packTextures(textures: [number, Picture][], maxSize: number) {
    let rows: RowEdge[] = [{ x: 0, y: 0, rowHeight: maxSize }];
    const findSpace = (pic: Picture): RowEdge => {
        const perfectMatch = rows.find(row => row.rowHeight === pic.height && row.x + pic.width < maxSize);
        if (perfectMatch) {
            return perfectMatch;
        }

        const noSplit = rows.find(row => pic.height < row.rowHeight && pic.height / row.rowHeight > .5 && row.x + pic.width < maxSize);
        if (noSplit) {
            return noSplit;
        }

        const smallFit = rows.find(row => pic.height < row.rowHeight && pic.height / row.rowHeight <= .5 && row.x + pic.width < maxSize);
        if (smallFit) {
            // split the row so insert a new row with the remainder of the space
            rows.push({ x: smallFit.x, y: smallFit.y + pic.height, rowHeight: smallFit.rowHeight - pic.height });
            // and change the row height to match the picture we're inserting
            smallFit.rowHeight = pic.height;
            return smallFit;
        }

        const end = rows[rows.length - 1];
        if (end.rowHeight >= pic.height) {
            // split
            rows.push({ x: end.x, y: end.y + pic.height, rowHeight: end.rowHeight - pic.height });
            end.rowHeight = pic.height;
            return end;
        }
        // no space!
        return null;
    }

    const imgArea = (pic: Picture) => pic.width * pic.height;

    let result: PackInfo[] = [];
    const sortedTx = [...textures].sort((a, b) => imgArea(b[1]) - imgArea(a[1]));
    for (const [idx, pic] of sortedTx) {
        let row = findSpace(pic);
        if (!row) {
            return null;
        }
        result.push({ pic, idx, x: row.x, y: row.y });
        row.x += pic.width;
    }

    return result;
}
