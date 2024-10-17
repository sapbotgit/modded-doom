<script lang="ts">
    import { T, useThrelte } from '@threlte/core';
    import { MeshBasicMaterial, PlaneGeometry, BufferGeometry } from 'three';
    import { useDoomMap } from '../DoomContext';
    import { TextureAtlas } from './TextureAtlas'
    import { buildLightMap, mapGeometryBuilder2, type LindefUpdater, type MapGeometryUpdater, type MapUpdater } from './GeometryBuilder';
    import Wireframe from '../Debug/Wireframe.svelte';
    import { mapMeshMaterials } from './MapMeshMaterial';

    const threlte = useThrelte();

    const emptyPlane = new PlaneGeometry(0, 0);
    let geometry: BufferGeometry = emptyPlane;
    let skyGeometry: BufferGeometry = geometry;

    const { renderSectors, map } = useDoomMap();

    console.time('map-geo')

    console.time('map-ta')
    const ta = new TextureAtlas(map.game.wad, threlte.renderer.capabilities.maxTextureSize);
    console.timeEnd('map-ta')

    console.time('map-geom')
    const mapBuilder = mapGeometryBuilder2(map.game.wad);
    let mapGeo: MapGeometryUpdater & { complete: MapUpdater } = (() => {
        let queue: MapUpdater[] = [];
        return {
            complete: (m: MapGeometryUpdater) => queue.forEach(fn => fn(m)),

            geometry: undefined,
            skyGeometry: undefined,
            moveFlat: (idx, z) => queue.push(m => m.moveFlat(idx, z)),
            applyFlatTexture: (idx, tx) => queue.push(m => m.applyFlatTexture(idx, tx)),
            applyWallTexture: (idx, tx, w, h, ox, oy) => queue.push(m => m.applyWallTexture(idx, tx, w, h, ox, oy)),
            changeWallHeight: (idx, top, height) => queue.push(m => m.changeWallHeight(idx, top, height)),
            flipZ: (idx) => queue.push(m => m.flipZ(idx)),
        };
    })();

    let linedefUpdaters = new Map<number, LindefUpdater>();
    for (const rs of renderSectors) {
        rs.linedefs.map(ld => {
            const updaters = mapBuilder.addLinedef(ld);
            linedefUpdaters.set(ld.num, updaters);

            if (ld.left) {
                const updateLeft = () => {
                    updaters.lower?.(mapGeo);
                    updaters.upper?.(mapGeo);
                    updaters.midLeft?.(mapGeo);
                };
                ld.left.xOffset.subscribe(updateLeft);
                ld.left.yOffset.subscribe(updateLeft);
                if (updaters.lower) {
                    ld.left.lower.subscribe(() => updaters.lower(mapGeo));
                }
                if (updaters.upper) {
                    ld.left.upper.subscribe(() => updaters.upper(mapGeo));
                }
                if (updaters.midLeft) {
                    ld.left.middle.subscribe(() => updaters.midLeft(mapGeo));
                }
            }
            const updateRight = () => {
                updaters.lower?.(mapGeo);
                updaters.upper?.(mapGeo);
                updaters.midRight?.(mapGeo);
                updaters.single?.(mapGeo);
            };
            ld.right.xOffset.subscribe(updateRight);
            ld.right.yOffset.subscribe(updateRight);
            if (updaters.lower) {
                ld.right.lower.subscribe(() => updaters.lower(mapGeo));
            }
            if (updaters.upper) {
                ld.right.upper.subscribe(() => updaters.upper(mapGeo));
            }
            ld.right.middle.subscribe(() =>{
                updaters.midRight?.(mapGeo);
                updaters.single?.(mapGeo);
            });
        });
        if (!rs.geometry) {
            // Plutonia MAP29?
            continue;
        }

        let [ceil, floor] = mapBuilder.addSector(rs);

        // subscribe for changes and update map geometry
        // update sector z
        rs.sector.zFloor.subscribe(z => mapGeo.moveFlat(floor, z));
        rs.sector.zCeil.subscribe(z => mapGeo.moveFlat(ceil, rs.sector.skyHeight ?? z));
        // update sector textures
        rs.sector.ceilFlat.subscribe(name => mapGeo.applyFlatTexture(ceil, name));
        rs.sector.floorFlat.subscribe(name => mapGeo.applyFlatTexture(floor, name));
    }

    // try to minimize subscriptions by grouping lindefs that listen to a sector change
    // and only subscribing to that sector once. I'm not sure it's worth it. Actually, I'm
    // not sure using svelte store makes sense anymore at all and I'll probably remove it
    // which should make this all simpler (I hope)
    for (const rs of renderSectors) {
        const updaters = [...new Set([
            ...rs.sector.portalSegs?.map(seg => seg.linedef) ?? [],
            ...rs.linedefs.map(ld => ld)
        ])];

        const lowers = updaters.map(e => linedefUpdaters.get(e.num).lower).filter(e => e);
        const uppers = updaters.map(e => linedefUpdaters.get(e.num).upper).filter(e => e);
        const midLefts = updaters.map(e => linedefUpdaters.get(e.num).midLeft).filter(e => e);
        const midRights = updaters.map(e => linedefUpdaters.get(e.num).midRight).filter(e => e);
        const singles = updaters.map(e => linedefUpdaters.get(e.num).single).filter(e => e);

        rs.sector.zFloor.subscribe(() => {
            lowers.forEach(fn => fn(mapGeo));
            uppers.forEach(fn => fn(mapGeo));
            midLefts.forEach(fn => fn(mapGeo));
            midRights.forEach(fn => fn(mapGeo));
            singles.forEach(fn => fn(mapGeo));
        });
        rs.sector.zCeil.subscribe(() => {
            lowers.forEach(fn => fn(mapGeo));
            uppers.forEach(fn => fn(mapGeo));
            midLefts.forEach(fn => fn(mapGeo));
            midRights.forEach(fn => fn(mapGeo));
            singles.forEach(fn => fn(mapGeo));
        });
    }

    console.timeEnd('map-geom')
    console.time('map-init')
    const mapData = mapBuilder.build(ta);
    mapGeo.complete(mapData);
    mapGeo = mapData as any;
    geometry = mapGeo.geometry;
    skyGeometry = mapGeo.skyGeometry;
    console.timeEnd('map-init')
    console.timeEnd('map-geo')

    const lightMap = buildLightMap(map.data.sectors);
    const { material, distanceMaterial, depthMaterial } = mapMeshMaterials(ta, lightMap);
    const skyMaterial = new MeshBasicMaterial({ depthWrite: true, colorWrite: false });

    // magic https://stackoverflow.com/questions/49873459
    const shadowBias = -0.004;

    const receiveShadow = true;
    const castShadow = receiveShadow;
    const { position } = map.player;
</script>

<T.Mesh
    renderOrder={0}
    geometry={skyGeometry}
    material={skyMaterial}
>
    <Wireframe />
</T.Mesh>

<T.Mesh
    renderOrder={1}
    {geometry}
    {material}
    customDepthMaterial={depthMaterial}
    customDistanceMaterial={distanceMaterial}
    {receiveShadow}
    {castShadow}
>
    <Wireframe />
</T.Mesh>

<T.PointLight
    {castShadow}
    color={0xff0000}
    intensity={50}
    distance={400}
    decay={0.2}
    position.x={$position.x}
    position.y={$position.y}
    position.z={$position.z + 40}
    shadow.bias={shadowBias}
/>
