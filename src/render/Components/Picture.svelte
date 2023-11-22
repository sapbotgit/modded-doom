<script lang="ts" context="module">
    // cache image url so we don't always create a new image context when we load a new image
    const cache = new Map<string, string>();
    let lastWad: DoomWad;
</script>
<script lang="ts">
    import { useDoom } from "../DoomContext";
    import type { DoomWad } from "../../doom";

    export let name: string;
    export let type: 'wall' | 'flat' | 'any' = 'any';
    export let wad: DoomWad = null;

    wad = wad ?? useDoom().wad;
    if (wad !== lastWad) {
        cache.clear();
    }

    $: dataUrl = imageDataUrl(wad, name, type);
    function imageDataUrl(wad: DoomWad, name: string, type: 'wall' | 'flat' | 'any') {
        const key = name + type;
        let dataUrl = cache.get(key);
        if (dataUrl) {
            return dataUrl;
        }

        const px =
            type === 'flat' ? wad.flatTextureData(name) :
            type === 'wall' ? wad.wallTextureData(name) :
            wad.graphic(name);
        if (!px) {
            return '';
        }

        try {
            // draw image onto canvas
            const canvas = document.createElement('canvas');
            canvas.width = px.width;
            canvas.height = px.height;
            const ctx = canvas.getContext('2d');
            const img = ctx.createImageData(canvas.width, canvas.height);
            px.toBuffer(img.data);
            ctx.putImageData(img, 0, 0);

            // convert to data url
            const dataUrl = canvas.toDataURL('image/png');
            cache.set(key, dataUrl);
            return dataUrl;
        } catch {
            // interestingly, some wads contain TITLEPIC but not playpal which means we have images but no palette.
            // We could supply a default palette but for the purpose of the table of wads, it doesn't seem worth it
            return '';
        }
    }
</script>

<img src={dataUrl} alt={name} />
