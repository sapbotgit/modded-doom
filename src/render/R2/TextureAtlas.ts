import { DataTexture, FloatType, NearestFilter, RepeatWrapping, SRGBColorSpace } from "three";
import type { DoomWad, Picture } from "../../doom";

type RowEdge = { x: number, y: number, rowHeight: number };

export class TextureAtlas {
    readonly index: DataTexture;
    readonly texture: DataTexture;
    private textures = new Map<string, [number, Picture]>();
    private flats = new Map<string, [number, Picture]>();

    private count = 0;
    private rows: RowEdge[];

    times = [0, 0, 0];

    constructor(private wad: DoomWad, private tSize: number) {
        this.rows = [{ x: 0, y: 0, rowHeight: this.tSize }];

        const textures = wad.texturesNames();
        const flats = wad.flatsNames();
        // TODO: make this 2D like lightMap in case we have more than tSize textures?
        const indexData = new Float32Array((textures.length + flats.length) * 4);
        const tAtlas = new DataTexture(indexData, flats.length + textures.length);
        tAtlas.type = FloatType;
        tAtlas.needsUpdate = true;
        this.index = tAtlas;

        const textureData = new Uint8ClampedArray(tSize * tSize * 4).fill(0);
        const texture = new DataTexture(textureData, tSize, tSize)
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.magFilter = NearestFilter;
        texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;
        this.texture = texture;
    }

    // animations cause jank after map load as the different frames are loaded into the atlas.
    // So we store the texture names that are part of animations and if one is loaded, we load the rest
    wallTexture(name: string): [number, Picture] {
        const start = new Date();
        let data = this.textures.get(name);
        if (!data) {
            const pic = this.wad.wallTextureData(name);
            data = this.insertTexture(name, pic);
            this.textures.set(name, data);

            if (this.wad.animatedWalls.has(name)) {
                // load the rest of the animation frames
                for (const frame of this.wad.animatedWalls.get(name).frames) {
                    if (frame === name) {
                        continue;
                    }
                    const pic = this.wad.wallTextureData(frame);
                    this.textures.set(frame, this.insertTexture(frame, pic));
                }
            }
        }
        this.times[0] += new Date().getTime() - start.getTime();
        return data;
    }

    private insertTexture(name: string, pic: Picture): [number, Picture] {
        const start = new Date();
        const row = this.findSpace(pic);
        if (!row) {
            // TODO: default texture?
            console.warn('texture atlas out of space', name);
            return null;
        }

        pic.toAtlasBuffer(this.texture.image.data, this.tSize, row.x, row.y);
        this.texture.needsUpdate = true;

        this.index.image.data[0 + this.count * 4] = row.x / this.tSize;
        this.index.image.data[1 + this.count * 4] = row.y / this.tSize;
        row.x += pic.width;
        this.index.image.data[2 + this.count * 4] = row.x / this.tSize;
        this.index.image.data[3 + this.count * 4] = (row.y + pic.height) / this.tSize;
        this.index.needsUpdate = true;

        this.count += 1;
        this.times[2] += new Date().getTime() - start.getTime();
        return [this.count - 1, pic];
    }

    // To create on demand we'll need a map of rows with their starting height and xoffset
    // On each insert, we move the row pointer forward by width. If full, we shift down by height.
    // If we find a row of the exact height, use it.
    // If a texture is 80% the height of a row (like 112 of a 128 tall row) we insert it
    // Else we create a new row
    private findSpace(pic: Picture): RowEdge {
        const perfectMatch = this.rows.find(row => row.rowHeight === pic.height && row.x + pic.width < this.tSize);
        if (perfectMatch) {
            return perfectMatch;
        }

        const noSplit = this.rows.find(row => pic.height < row.rowHeight && pic.height / row.rowHeight > .8 && row.x + pic.width < this.tSize);
        if (noSplit) {
            return noSplit;
        }

        // const smallFit = this.rows.find(row => pic.height < row.rowHeight && pic.height / row.rowHeight <= .3 && row.x + pic.width < this.tSize);
        // if (smallFit) {
        //     // split the row so insert a new row with the remainder of the space
        //     this.rows.push({ x: smallFit.x, y: smallFit.y + pic.height, rowHeight: smallFit.rowHeight - pic.height });
        //     // and change the row height to match the picture we're inserting
        //     smallFit.rowHeight = pic.height;
        //     return smallFit;
        // }

        const end = this.rows[this.rows.length - 1];
        if (end.rowHeight >= pic.height) {
            // split
            this.rows.push({ x: end.x, y: end.y + pic.height, rowHeight: end.rowHeight - pic.height });
            end.rowHeight = pic.height;
            return end;
        }
        // no space!
        return null;
    }

    flatTexture(name: string): [number, Picture] {
        const start = new Date();
        let data = this.flats.get(name);
        if (!data) {
            const pic = this.wad.flatTextureData(name);
            data = this.insertTexture(name, pic);
            this.flats.set(name, data);

            if (this.wad.animatedFlats.has(name)) {
                // load the rest of the animation frames
                for (const frame of this.wad.animatedFlats.get(name).frames) {
                    if (frame === name) {
                        continue;
                    }
                    const pic = this.wad.flatTextureData(frame);
                    this.flats.set(frame, this.insertTexture(frame, pic));
                }
            }
        }
        this.times[1] += new Date().getTime() - start.getTime();
        return data;
    }
}