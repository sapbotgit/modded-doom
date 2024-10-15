<script lang="ts" context="module">
    export interface GeometryBuilder {
        addWallFragment(geo: BufferGeometry, sectorNum: number): number;
        applyWallTexture(geo: number, textureName: string, width: number, height: number, offsetX: number, offsetY: number): void;
        changeWallHeight(geo: number, top: number, height: number): void;

        addFlat(geo: BufferGeometry, sectorNum: number): number;
        applyFlatTexture(geo: number, textureName: string): void;
        moveFlat(geo: number, zPosition: number): void;
    }
</script>
<script lang="ts">
    import { T, useThrelte } from '@threlte/core';
    import { MeshBasicMaterial, PlaneGeometry, BufferGeometry, BufferAttribute, IntType, type TypedArray } from 'three';
    import { useDoomMap } from '../DoomContext';
    import { TextureAtlas } from './TextureAtlas'
    import { MapRenderGeometryBuilder } from './GeometryBuilder';
    import Wireframe from '../Debug/Wireframe.svelte';
    import { mapMeshMaterials } from './MapMeshMaterial';
    import Sector from './Sector.svelte';
    import { setContext } from 'svelte';
    import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';

    const threlte = useThrelte();

    const intBufferAttribute = (array: TypedArray, itemSize: number) => {
        const attr = new BufferAttribute(array, itemSize);
        attr.gpuType = IntType;
        return attr;
    }

    const emptyPlane = new PlaneGeometry(0, 0);
    emptyPlane.setAttribute('texN', intBufferAttribute(new Uint16Array(1).fill(0), 1));
    emptyPlane.setAttribute('doomLight', intBufferAttribute(new Uint16Array(1).fill(0), 1));
    let geometry: BufferGeometry = emptyPlane;
    let skyGeometry: BufferGeometry = geometry;

    const { renderSectors, map } = useDoomMap();
    const ta = new TextureAtlas(map.game.wad, threlte.renderer.capabilities.maxTextureSize);

    function builder(): GeometryBuilder {
        let builtCount = -1;
        let pendingUpdates = [];
        let geos: BufferGeometry[] = [];

        type GeoInfo = { vertexOffset: number, vertexCount: number, sky: boolean };
        let geoInfo: GeoInfo[] = [];
        let numVertex = 0;
        let skyVertex = 0;

        const addWallFragment = (geo: BufferGeometry, sectorNum: number) => {
            const sky = geo.userData['sky'];
            const vertexCount = geo.attributes.position.count;
            const vertexOffset = sky ? skyVertex : numVertex;
            if (sky) {
                skyVertex += vertexCount;
            } else {
                numVertex += vertexCount;
            }

            geo.setAttribute('texN', intBufferAttribute(new Uint16Array(vertexCount).fill(0), 1));
            geo.setAttribute('doomLight', intBufferAttribute(new Uint16Array(vertexCount).fill(sectorNum), 1));
            geos.push(geo);
            geoInfo.push({ vertexCount, vertexOffset, sky });
            scheduleBuild();
            return geos.length - 1;
        };

        const applyWallTexture = (geoIndex: number, textureName: string, width: number, height: number, offsetX: number, offsetY: number) => {
            if (geoInfo[geoIndex].sky) {
                return;
            }
            if (builtCount < geoIndex) {
                return pendingUpdates.push(() => applyWallTexture(geoIndex, textureName, width, height, offsetX, offsetY));
            }
            if (!textureName) {
                changeWallHeight(geoIndex, 0, 0);
                return;
            }

            const [index, tx] = ta.wallTexture(textureName);
            const vertexOffset = geoInfo[geoIndex].vertexOffset;
            const geo = geoInfo[geoIndex].sky ? skyGeometry : geometry;

            const invHeight = 1 / tx.height;
            geo.attributes.uv.array[2 * vertexOffset + 0] = 0;
            geo.attributes.uv.array[2 * vertexOffset + 1] = ((height % tx.height) - height) * invHeight;
            geo.attributes.uv.array[2 * vertexOffset + 2] = width / tx.width;
            geo.attributes.uv.array[2 * vertexOffset + 3] = ((height % tx.height) - height) * invHeight;
            geo.attributes.uv.array[2 * vertexOffset + 4] = 0;
            geo.attributes.uv.array[2 * vertexOffset + 5] = (height % tx.height) * invHeight;
            geo.attributes.uv.array[2 * vertexOffset + 6] = width / tx.width;
            geo.attributes.uv.array[2 * vertexOffset + 7] = (height % tx.height) * invHeight;
            // set texture index
            geo.attributes.texN.array[vertexOffset + 0] = index;
            geo.attributes.texN.array[vertexOffset + 1] = index;
            geo.attributes.texN.array[vertexOffset + 2] = index;
            geo.attributes.texN.array[vertexOffset + 3] = index;

            geo.attributes.texN.needsUpdate = true;
            geo.attributes.uv.needsUpdate = true;
        };

        const changeWallHeight = (geoIndex: number, top: number, height: number) => {
            if (builtCount < geoIndex) {
                return pendingUpdates.push(() => changeWallHeight(geoIndex, top ,height));
            }

            const offset = geoInfo[geoIndex].vertexOffset * 3;
            const geo = geoInfo[geoIndex].sky ? skyGeometry : geometry;
            geo.attributes.position.array[offset + 2] = top;
            geo.attributes.position.array[offset + 5] = top;
            geo.attributes.position.array[offset + 8] = top - height;
            geo.attributes.position.array[offset + 11] = top - height;
            geo.attributes.position.needsUpdate = true;
        };

        const addFlat = (geo: BufferGeometry, sectorNum: number): number => {
            const sky = geo.userData['sky'];
            const vertexCount = geo.attributes.position.count;
            const vertexOffset = sky ? skyVertex : numVertex;
            if (sky) {
                skyVertex += vertexCount;
            } else {
                numVertex += vertexCount;
            }

            for (let i = 0; i < geo.attributes.uv.array.length; i++) {
                geo.attributes.uv.array[i] /= 64;
            }
            geo.setAttribute('texN', intBufferAttribute(new Uint16Array(vertexCount).fill(0), 1));
            geo.setAttribute('doomLight', intBufferAttribute(new Uint16Array(vertexCount).fill(sectorNum), 1));
            geos.push(geo);
            geoInfo.push({ vertexCount, vertexOffset, sky });
            scheduleBuild();
            return geos.length - 1;
        };

        const applyFlatTexture = (geoIndex: number, textureName: string) => {
            if (geoInfo[geoIndex].sky) {
                return;
            }
            if (builtCount < geoIndex) {
                return pendingUpdates.push(() => applyFlatTexture(geoIndex, textureName));
            }

            let index = ta.flatTexture(textureName)[0];
            const vertexCount = geoInfo[geoIndex].vertexCount;
            const vertexOffset = geoInfo[geoIndex].vertexOffset;
            for (let i = 0; i < vertexCount; i++) {
                geometry.attributes.texN.array[vertexOffset + i] = index;
            }
            geometry.attributes.texN.needsUpdate = true;
        };

        const moveFlat = (geoIndex: number, zPosition: number) => {
            if (builtCount < geoIndex) {
                return pendingUpdates.push(() => moveFlat(geoIndex, zPosition));
            }

            const geo = geoInfo[geoIndex].sky ? skyGeometry : geometry;
            const vertexCount = geoInfo[geoIndex].vertexCount;
            const vertexOffset = geoInfo[geoIndex].vertexOffset;
            let end = (vertexCount + vertexOffset) * 3;
            for (let i = vertexOffset * 3; i < end; i += 3) {
                geo.attributes.position.array[i + 2] = zPosition;
            }
            geo.attributes.position.needsUpdate = true;
        };

        const mergeGeos = (geos: BufferGeometry[]) => {
            if (!geos.length) {
                // BufferGeometryUtils.mergeGeometries() fails if array is empty so add a placeholder geometry
                geos.push(emptyPlane);
            }
            return BufferGeometryUtils.mergeGeometries(geos);
        }

        let timeout: any = 0;
        function scheduleBuild() {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                builtCount = geos.length;

                skyGeometry = mergeGeos(geos.filter(e => e.userData['sky']));
                skyGeometry.name = 'sky'
                geometry = mergeGeos(geos.filter(e => !e.userData['sky']));
                geometry.name = 'map'

                pendingUpdates.forEach(fn => fn());
                pendingUpdates.length = 0;
                console.timeEnd('map-geo')
            }, 1);
        }

        return {
            addFlat, moveFlat, applyFlatTexture,
            addWallFragment, applyWallTexture, changeWallHeight,
        };
    }
    console.time('map-geo')
    setContext('doom-map-geo', builder());

    const mapBuilder = new MapRenderGeometryBuilder(ta);
    for (const rs of renderSectors) {
        rs.linedefs.forEach(ld => mapBuilder.addLinedef(ld));
        if (!rs.geometry) {
            // Plutonia MAP29?
            continue;
        }
        // TODO: what about hack floor/ceiling? That whole thing is buggy and needs a rewrite anyway
        mapBuilder.addFlat(rs, rs.sector.floorFlat.val, rs.sector.zFloor.val);
        mapBuilder.addFlat(rs, rs.sector.ceilFlat.val, rs.sector.skyHeight ?? rs.sector.zCeil.val, true);
    }

    const mapGeo = mapBuilder.build();

    const { material, distanceMaterial, depthMaterial } = mapMeshMaterials(ta, mapGeo);
    const skyMaterial = new MeshBasicMaterial({ depthWrite: true, colorWrite: false });

    // magic https://stackoverflow.com/questions/49873459
    const shadowBias = -0.004;

    const receiveShadow = true;
    const castShadow = receiveShadow;
    const { position } = map.player;
</script>

{#each renderSectors as renderSector}
    <Sector {renderSector} />
{/each}

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
