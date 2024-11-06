import { DataTexture, FloatType, NearestFilter, RGBAIntegerFormat, ShortType, SRGBColorSpace } from "three";
import { DoomWad, SpriteNames, type Picture } from "../../../doom";

function findNearestPower2(n: number) {
    let t = 1;
    while (t < n) {
        t *= 2;
    }
    return t;
}

// TODO: there is a lot of similar functionality with TextureAtlas but building the indexes
// requires us to know how many textures we're adding so maybe we need to "build" an atlas.
// Someday I'll clean this up...
type RowEdge = { x: number, y: number, rowHeight: number };
export class SpriteSheet {
    readonly uvIndex: DataTexture;
    readonly spriteInfo: DataTexture;
    readonly sheet: DataTexture;
    private spriteFrames = {};

    private rows: RowEdge[];

    constructor(wad: DoomWad, private tSize: number) {
        this.rows = [{ x: 0, y: 0, rowHeight: this.tSize }];

        const sprites = SpriteNames.map(sprite => wad.spriteFrames(sprite).flat().flat().map(f => ({ ...f, sprite }))).flat();

        const sz = findNearestPower2(Math.sqrt(sprites.length));
        const tAtlas = new DataTexture(new Float32Array(sz * sz * 4), sz, sz);
        tAtlas.type = FloatType;
        this.uvIndex = tAtlas;

        const tSpriteInfo = new DataTexture(new Int16Array(sz * sz * 4), sz, sz);
        tSpriteInfo.type = ShortType;
        tSpriteInfo.format = RGBAIntegerFormat;
        tSpriteInfo.internalFormat = 'RGBA16I';
        tSpriteInfo.magFilter = tSpriteInfo.minFilter = NearestFilter;
        tSpriteInfo.generateMipmaps = false;
        this.spriteInfo = tSpriteInfo;

        const textureData = new Uint8ClampedArray(tSize * tSize * 4).fill(0);
        const texture = new DataTexture(textureData, tSize, tSize)
        texture.colorSpace = SRGBColorSpace;
        this.sheet = texture;

        const storeSpriteInfo = (idx: number, gfx: Picture, frame: { mirror: boolean, rotation: number }) => {
            this.spriteInfo.image.data[0 + idx * 4] = gfx.xOffset;
            this.spriteInfo.image.data[1 + idx * 4] = gfx.yOffset;
            this.spriteInfo.image.data[2 + idx * 4] = frame.mirror ? -1 : 1;
            this.spriteInfo.image.data[3 + idx * 4] = frame.rotation;
        }

        let spriteGfx = new Map<string, number>();
        for (let idx = 0; idx < sprites.length; idx++) {
            const frame = sprites[idx];
            const gfx = wad.spriteTextureData(frame.name);

            let orig = spriteGfx.get(frame.name);
            if (orig) {
                // copy uv coordinates
                this.uvIndex.image.data[0 + idx * 4] = this.uvIndex.image.data[0 + orig * 4];
                this.uvIndex.image.data[1 + idx * 4] = this.uvIndex.image.data[1 + orig * 4];
                this.uvIndex.image.data[2 + idx * 4] = this.uvIndex.image.data[2 + orig * 4];
                this.uvIndex.image.data[3 + idx * 4] = this.uvIndex.image.data[3 + orig * 4];

                storeSpriteInfo(idx, gfx, frame);
                continue;
            }

            // insert image, index frame, and store info
            this.insert(idx, frame.name, gfx);
            spriteGfx.set(frame.name, idx);
            storeSpriteInfo(idx, gfx, frame);
            // index frame
            let frames = this.spriteFrames[frame.sprite];
            if (!frames) {
                frames = [];
                this.spriteFrames[frame.sprite] = frames;
            }
            if (frames[frame.frame] === undefined) {
                frames[frame.frame] = idx;
            }
        }
        this.uvIndex.needsUpdate = true;
        this.spriteInfo.needsUpdate = true;
    }

    indexOf(sprite: string, frame: number) {
        return this.spriteFrames[sprite][frame];
    }

    private insert(idx: number, key: string, pic: Picture) {
        const row = this.findSpace(pic);
        if (!row) {
            // TODO: default texture?
            console.warn('texture atlas out of space', key);
            return null;
        }

        pic.toAtlasBuffer(this.sheet.image.data, this.tSize, row.x, row.y);
        this.sheet.needsUpdate = true;

        this.uvIndex.image.data[0 + idx * 4] = row.x / this.tSize;
        this.uvIndex.image.data[1 + idx * 4] = row.y / this.tSize;
        row.x += pic.width;
        this.uvIndex.image.data[2 + idx * 4] = row.x / this.tSize;
        this.uvIndex.image.data[3 + idx * 4] = (row.y + pic.height) / this.tSize;
        this.uvIndex.needsUpdate = true;
    }

    // To create on demand we'll need a map of rows with their starting height and xoffset
    // On each insert, we move the row pointer forward by width. If full, we shift down by height.
    // If we find a row of the exact height, use it.
    // If a texture is 80% the height of a row (like 112 of a 128 tall row) we insert it
    // Else we create a new row
    // We could do even better but there doesn't seem to be a need to (yet)
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
}
