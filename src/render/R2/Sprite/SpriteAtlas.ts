import { DataTexture, FloatType, NearestFilter, RepeatWrapping, RGBAIntegerFormat, ShortType, SRGBColorSpace } from "three";
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
    private spriteFrames = new Map<string, Map<number, number>>;

    private count = 0;
    private rows: RowEdge[];

    constructor(wad: DoomWad, private tSize: number) {
        this.rows = [{ x: 0, y: 0, rowHeight: this.tSize }];

        const sprites = SpriteNames.map(sprite => wad.spriteFrames(sprite).flat().flat().map(f => ({ ...f, sprite }))).flat();

        // TODO: make this 2D like lightMap in case we have more than tSize textures?
        // TODO: probably should be nearest power of two width and height
        const tAtlas = new DataTexture(new Float32Array(sprites.length * 4), sprites.length);
        tAtlas.type = FloatType;
        this.uvIndex = tAtlas;

        const tSpriteInfo = new DataTexture(new Int16Array(sprites.length * 4), sprites.length);
        tSpriteInfo.type = ShortType;
        tSpriteInfo.format = RGBAIntegerFormat;
        tSpriteInfo.internalFormat = 'RGBA16I';
        tSpriteInfo.magFilter = tSpriteInfo.minFilter = NearestFilter;
        tSpriteInfo.wrapT = tSpriteInfo.wrapS = RepeatWrapping;
        this.spriteInfo = tSpriteInfo;

        const textureData = new Uint8ClampedArray(tSize * tSize * 4).fill(0);
        const texture = new DataTexture(textureData, tSize, tSize)
        texture.wrapT = texture.wrapS = RepeatWrapping;
        texture.magFilter = texture.minFilter = NearestFilter;
        texture.colorSpace = SRGBColorSpace;
        this.sheet = texture;

        for (const frame of sprites) {
            const gfx = wad.spriteTextureData(frame.name);
            if (frame.rotation !== 0 && frame.rotation !== 1) {
                // TODO: fix rotations
                continue;
            }
            const idx = this.insert(frame.name, gfx);

            this.spriteInfo.image.data[0 + idx * 4] = gfx.xOffset;
            this.spriteInfo.image.data[1 + idx * 4] = gfx.yOffset;
            this.spriteInfo.image.data[2 + idx * 4] = frame.mirror ? -1 : 1;
            this.spriteInfo.image.data[3 + idx * 4] = 0;
            this.spriteInfo.needsUpdate = true;

            // TODO: also offset and if there are rotations/mirrors?

            let frames = this.spriteFrames.get(frame.sprite);
            if (!frames) {
                frames = new Map<number, number>();
                this.spriteFrames.set(frame.sprite, frames);
            }
            frames.set(frame.frame, idx);
        }
    }

    indexOf(sprite: string, frame: number) {
        // are maps the best lookup here or can use use arrays (or arrays of integers?)
        return this.spriteFrames.get(sprite).get(frame);
    }

    private insert(sprite: string, pic: Picture) {
        const row = this.findSpace(pic);
        if (!row) {
            // TODO: default texture?
            console.warn('texture atlas out of space', sprite);
            return null;
        }

        pic.toAtlasBuffer(this.sheet.image.data, this.tSize, row.x, row.y);
        this.sheet.needsUpdate = true;

        this.uvIndex.image.data[0 + this.count * 4] = row.x / this.tSize;
        this.uvIndex.image.data[1 + this.count * 4] = row.y / this.tSize;
        row.x += pic.width;
        this.uvIndex.image.data[2 + this.count * 4] = row.x / this.tSize;
        this.uvIndex.image.data[3 + this.count * 4] = (row.y + pic.height) / this.tSize;
        this.uvIndex.needsUpdate = true;

        this.count += 1;
        return this.count - 1;
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
