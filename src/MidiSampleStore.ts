export interface StoredMidi {
    readonly status: number;
    arrayBuffer(): Promise<ArrayBuffer>;
    json(): Promise<any>;
    text(): Promise<string>;
}

interface MidiSample {
    status: number;
    url: string;
    buffer: ArrayBuffer;
}

export class MidiSampleStore {
    private dec = new TextDecoder()

    ready: Promise<void>;
    private db: IDBDatabase;

    constructor() {
        const dbRequest = indexedDB.open('midi-sample-db', 6);
        this.ready = new Promise((resolve, reject) => {
            // TODO: What do we do here? dbRequest.onerror = () => ...
            dbRequest.onupgradeneeded = ev => {
                this.db = (ev.target as any).result;
                if (!this.db.objectStoreNames.contains('samples')) {
                    this.db.createObjectStore('samples', { keyPath: 'url' });
                }
            };
            dbRequest.onsuccess = ev => {
                this.db = (ev.target as any).result;
                resolve();
            };
            dbRequest.onerror = reject;
        });
    }

    async fetch(url: string): Promise<StoredMidi> {
        await this.ready;
        const req = this.db.transaction('samples', 'readonly')
            .objectStore('samples')
            .get(url);
        return new Promise((resolve, reject) => {
            req.onerror = reject;
            req.onsuccess = ev => {
                const record: MidiSample = (ev.target as any).result;
                if (record && record.status === 200) {
                    const arrayBuffer = () => Promise.resolve(record.buffer);
                    const text = () => arrayBuffer().then(buff => this.dec.decode(buff));
                    const json = () => text().then(JSON.parse);
                    resolve({ status: record.status, text, json, arrayBuffer });
                } else {
                    resolve(this.cacheAndStore(url));
                }
            };
        });
    }

    private async cacheAndStore(url: string): Promise<StoredMidi> {
        const response = await fetch(new Request(url));
        const buffer = await response.arrayBuffer();
        const tr = this.db.transaction('samples', 'readwrite');
        tr.objectStore('samples').put({ status: response.status, url, buffer });
        // TODO: tr.onerror = () => ...

        const arrayBuffer = () => Promise.resolve(buffer);
        const text = () => arrayBuffer().then(buff => this.dec.decode(buff));
        const json = () => text().then(JSON.parse);
        return { status: response.status, text, json, arrayBuffer };
    }
}
