import { store, DoomWad, WadFile } from "./doom";

export interface WADInfo {
    name: string;
    image: string;
    iwad: boolean;
    episodicMaps: boolean;
    mapCount: number;
    flatCount: number;
    textureCount: number;
    // TODO: add these?
    // spriteCount: number;
    // soundCount: number;
    // musicCount: number;
}

export class WadStore {
    wads = store([] as WADInfo[]);

    ready: Promise<void>;
    private db: IDBDatabase;

    constructor() {
        const dbRequest = indexedDB.open('doom-db', 6);
        this.ready = new Promise((resolve, reject) => {
            // TODO: What do we do here? dbRequest.onerror = () => ...
            dbRequest.onupgradeneeded = ev => {
                this.db = (ev.target as any).result;
                // separate tables because we want to have info about the wad without actually keeping the wad in memory
                if (!this.db.objectStoreNames.contains('wad-info')) {
                    this.db.createObjectStore('wad-info', { keyPath: 'name' });
                }
                if (!this.db.objectStoreNames.contains('wads')) {
                    this.db.createObjectStore('wads', { keyPath: 'name' });
                }
                resolve();
            };
            dbRequest.onsuccess = ev => {
                this.db = (ev.target as any).result;
                this.updateWadList();
                resolve();
            };
            dbRequest.onerror = reject;
        });
    }

    async fetchWad(name: string): Promise<ArrayBuffer> {
        await this.ready;
        const req = this.db.transaction('wads', 'readonly')
            .objectStore('wads')
            .get(name);
        return new Promise((resolve, reject) => {
            req.onerror = reject;
            req.onsuccess = ev => {
                const record = (ev.target as any).result;
                resolve(record.buff);
            };
        });
    }

    saveWad(name: string, buff: ArrayBuffer) {
        name = name.toLowerCase();
        name = name.endsWith('.wad') ? name.slice(0, -4) : name;

        // TODO: what if buff is not actually a doom wad?
        const wad = new DoomWad(name, [new WadFile(name, buff)]);
        const info: WADInfo = {
            name,
            image: imageDataUrl(wad, 'TITLEPIC'),
            iwad: wad.isIWAD,
            episodicMaps: wad.mapNames.find(name => name.startsWith('E')) !== undefined,
            mapCount: wad.mapNames.length,
            flatCount: wad.flatsNames.length,
            textureCount: wad.texturesNames.length,
        };

        const tr = this.db.transaction(['wad-info', 'wads'], 'readwrite');
        tr.objectStore('wads').put({ name, buff });
        tr.objectStore('wad-info').put(info);
        // TODO: tr.onerror = () => ...
        tr.oncomplete = () => this.updateWadList();
    }

    removeWad(name: string) {
        const tr = this.db.transaction(['wad-info', 'wads'], 'readwrite');
        tr.objectStore('wads').delete(name);
        tr.objectStore('wad-info').delete(name);
        // TODO: tr.onerror = () => ...
        tr.oncomplete = () => this.updateWadList();
    }

    private updateWadList() {
        const req = this.db.transaction('wad-info', 'readonly')
            .objectStore('wad-info')
            .getAll();
        // TODO: req.onerror = () => ...
        req.onsuccess = ev => {
            const data: WADInfo[] = (ev.target as any).result;
            this.wads.set(data.sort((a, b) => a.name.localeCompare(b.name)));
        }
    }
}

function imageDataUrl(wad: DoomWad, name: string) {
    const px = wad.graphic(name);
    if (!px) {
        return null;
    }

    try {
        const canvas = document.createElement('canvas');
        canvas.width = px.width;
        canvas.height = px.height;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(canvas.width, canvas.height);
        px.toBuffer(img.data);
        ctx.putImageData(img, 0, 0);
        return canvas.toDataURL('image/jpeg');
    } catch {
        // interestingly, some wads contain TITLEPIC but not playpal which means we have images but no palette.
        // We could supply a default palette but for the purpose of the table of wads, it doesn't seem worth it
        return null;
    }
}
