import { DataTexture, SRGBColorSpace } from "three";
import type Sector from "../Map/Sector.svelte";
import { sineIn } from "svelte/easing";

// TODO: How many copies of this function do we have?
function findNearestPower2(n: number) {
    let t = 1;
    while (t < n) {
        t *= 2;
    }
    return t;
}

// TODO: Should we use sectors or render sector (because of renderSector.flatLighting)?
export type MapLighting = ReturnType<typeof buildLightMap>;
export function buildLightMap(sectors: Sector[]) {
    // NB: only use SRGBColorSpace for one texture because otherwise we apply it twice.
    // Also, applying to lightLevels seems to look a little brighter than applying to lightMap
    const maxLight = 255;
    const scaledLight = new Uint8ClampedArray(16 * 16 * 4);
    const lightLevels = new DataTexture(scaledLight, 16, 16);
    for (let i = 0; i < maxLight + 1; i++) {
        // scale light using a curve to make it look more like doom
        const light = Math.floor(sineIn(i / maxLight) * maxLight);
        scaledLight[i * 4 + 0] = light;
        scaledLight[i * 4 + 1] = light;
        scaledLight[i * 4 + 2] = light;
        scaledLight[i * 4 + 3] = 255;
    }
    lightLevels.colorSpace = SRGBColorSpace;
    lightLevels.needsUpdate = true;

    const textureSize = findNearestPower2(Math.sqrt(sectors.length));
    const sectorLights = new Uint8ClampedArray(textureSize * textureSize * 4);
    const lightMap = new DataTexture(sectorLights, textureSize, textureSize);
    const subs = sectors.map((sector, i) =>
        sector.light.subscribe(light => {
            const lightVal = Math.max(0, Math.min(maxLight, light));
            sectorLights[i * 4 + 0] = lightVal;
            sectorLights[i * 4 + 1] = lightVal;
            sectorLights[i * 4 + 2] = lightVal;
            sectorLights[i * 4 + 3] = 255;
            lightMap.needsUpdate = true;
        }));
    const dispose = () => subs.forEach(fn => fn());
    return { lightMap, lightLevels, dispose };
}
