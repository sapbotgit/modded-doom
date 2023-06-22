<script lang="ts">
    import { PlaneGeometry, MeshStandardMaterial, Material, Texture, BufferGeometry, ShapeGeometry, Shape, Color, BackSide } from 'three'
    import {
        DirectionalLight,
        HemisphereLight,
        Mesh,
        PerspectiveCamera,
        Canvas,
        type Rotation,
        type Position,
    } from "@threlte/core";

    import { MapTextures } from './Texture';
    import type { DoomMap, DoomWad, LineDef, Sector, Thing, SideDef, RenderSector } from "../doomwad";
    import FirstPersonControls from './FirstPersonControls.svelte';
    import Stats from './Debug/Stats.svelte';
    export let wad: DoomWad;
    export let map: DoomMap;

    const useTextures = true;

    let sect: Sector;
    const playerHeight = 41;
    const padding = 40;
    let pZHeight = 0;
    let p1: Thing = null;
    let target: Position = {};
    let left = 0;
    let top = 0;
    let width = 0;
    let height = 0;
    $: if (map.vertexes) {
        p1 = map.things.find(e => e.type === 1);
        const angRad = p1.angle * Math.PI / 180;
        const tx = 10 * Math.cos(angRad) + p1.x;
        const tz = 10 * -Math.sin(angRad) - p1.y;
        sect = map.findSector(p1.x, p1.y)
        pZHeight = playerHeight + sect.zFloor;
        target = { x: tx, y: pZHeight, z: tz };

        left = map.vertexes[0].x;
        top = map.vertexes[0].y;
        let right = map.vertexes[0].x;
        let bottom = map.vertexes[0].y;
        for (const ld of map.linedefs) {
            left = Math.min(ld.v1.x, ld.v2.x, left);
            right = Math.max(ld.v1.x, ld.v2.x, right);
            top = Math.min(ld.v1.y, ld.v2.y, top);
            bottom = Math.max(ld.v1.y, ld.v2.y, bottom);
        }
        width = Math.abs(left - padding) + Math.abs(right + padding);
        height = Math.abs(top - padding) + Math.abs(bottom + padding);
    }

    const textures = new MapTextures(wad);

    type MeshProps = { rotation: Rotation, position: Position, geometry: BufferGeometry, material: Material | Material[] };
    $: sectorMeshes = map.renderSectors.map((rsec, i) => toSectorMeshes(rsec, namedColor(i))).flat();

    function meshProps(ld: LineDef, height: number, top: number, sd: SideDef, texture: Texture, type: 'upper' | 'lower' | 'middle', flip: boolean = false): MeshProps {
        const vx = ld.v2.x - ld.v1.x;
        const vy = ld.v2.y - ld.v1.y;
        const width = Math.sqrt(vx * vx + vy * vy);
        const geometry = new PlaneGeometry(width, height)

        const x = (ld.v1.x + ld.v2.x) * .5;
        const y = top - height * .5;
        const z = -(ld.v1.y + ld.v2.y) * .5;
        const position = { x, y, z };

        const invlen = 1 / width;
        const offset = flip ? Math.PI : 0;
        const rotation = { y: Math.atan2(vy * invlen, vx * invlen) + offset };

        // TODO: don't always use transparent. many textures don't need it. Does it matter though?
        const material = (texture && useTextures) ?
            new MeshStandardMaterial({ map: textures.positionWall(texture, width, height, ld, sd, type), transparent: true }) :
            new MeshStandardMaterial({ color: lineStroke(ld) });

        return { rotation, position, geometry, material };
    }

    function meshes(ld: LineDef) {
        let geos: MeshProps[] = [];
        if (ld.flags & 0x0004) {
            // two-sided so figure out top and bottom
            if (ld.left.sector.zCeil !== ld.right.sector.zCeil) {
                const height = Math.abs(ld.left.sector.zCeil - ld.right.sector.zCeil);
                const top = Math.max(ld.right.sector.zCeil, ld.left.sector.zCeil);
                const useLeft = ld.left.sector.zCeil > ld.right.sector.zCeil;
                const texture = textures.get(useLeft ? ld.left.upper : ld.right.upper, 'wall');
                const sd = useLeft ? ld.left : ld.right;
                geos.push(meshProps(ld, height, top, sd, texture, 'upper', useLeft));
            }
            if (ld.left.sector.zFloor !== ld.right.sector.zFloor) {
                const height = Math.abs(ld.left.sector.zFloor - ld.right.sector.zFloor);
                const top = Math.max(ld.right.sector.zFloor, ld.left.sector.zFloor);
                const useLeft = ld.left.sector.zFloor < ld.right.sector.zFloor;
                const texture = textures.get(useLeft ? ld.left.lower : ld.right.lower, 'wall');
                const sd = useLeft ? ld.left : ld.right;
                geos.push(meshProps(ld, height, top, sd, texture, 'lower', useLeft));
            }
            // and middle(s)
            const top = Math.min(ld.left.sector.zCeil, ld.right.sector.zCeil);
            const height = top - Math.max(ld.left.sector.zFloor, ld.right.sector.zFloor);
            if (ld.left.middle) {
                const texture = textures.get(ld.left.middle, 'wall');
                geos.push(meshProps(ld, height, top, ld.left, texture, 'middle', true));
            }
            if (ld.right.middle) {
                const texture = textures.get(ld.right.middle, 'wall');
                geos.push(meshProps(ld, height, top, ld.right, texture, 'middle'));
            }
        } else {
            const top = ld.right.sector.zCeil;
            const height = top - ld.right.sector.zFloor;
            const texture = textures.get(ld.right.middle, 'wall');
            geos.push(meshProps(ld, height, top, ld.right, texture, 'middle'));
        }
        return geos;
    }

    function lineStroke(ld: LineDef) {
        return !ld.left ? wad.palettes[0][176] :
            (ld.left.sector.zFloor !== ld.right.sector.zFloor) ? wad.palettes[0][64] :
            (ld.left.sector.zCeil !== ld.right.sector.zCeil) ?  wad.palettes[0][231] :
            wad.palettes[0][96];
    }

    function namedColor(idx) {
        return Object.values(Color.NAMES)[idx % Object.keys(Color.NAMES).length];
    }

    function toSectorMeshes(renderSector: RenderSector, color: number) {
        type RenderSectorMeshProps = { renderSector: RenderSector } & MeshProps;
        const geos: RenderSectorMeshProps[] = [];

        const { sector, vertexes } = renderSector;
        const shape = new Shape();
        shape.autoClose = true;
        shape.moveTo(vertexes[0].x, vertexes[0].y);
        for (let i = 1; i < vertexes.length; i++) {
            shape.lineTo(vertexes[i].x, vertexes[i].y);
        }
        const geometry = new ShapeGeometry(shape, 1);

        // floor
        let position = { x:0, y: sector.zFloor, z:0 };
        let material = useTextures && sector.floortFlat ?
            new MeshStandardMaterial({ map: textures.positionFlat(textures.get(sector.floortFlat, 'flat')) }) :
            new MeshStandardMaterial({ color });
        let rotation = { x: -Math.PI/2 };
        geos.push({ renderSector, rotation, position, geometry, material });

        // ceil
        position = { x:0, y: sector.zCeil, z:0 };
        material = useTextures && sector.ceilFlat ?
            new MeshStandardMaterial({ map: textures.positionFlat(textures.get(sector.ceilFlat, 'flat')), side:BackSide }) :
            new MeshStandardMaterial({ color, side:BackSide });
        geos.push({ renderSector, rotation, position, geometry, material });

        return geos;
    }

    function hitWall(mp: MeshProps, ld: LineDef) {
        console.log(mp, ld)
    }

    function hitFloor(mp: MeshProps, rsec: RenderSector) {
        console.log(mp, rsec)
    }
</script>

<Canvas size={{ width: 800, height: 600 }}>
    <Stats />

    <PerspectiveCamera lookAt={target} position={{ x: p1.x, y: pZHeight, z: -p1.y }} far={100000} fov={70}>
        <FirstPersonControls {map} />
    </PerspectiveCamera>

    <DirectionalLight shadow color={'white'} position={{ x: -15, y: 45, z: 20 }} intensity={0.5} />
    <DirectionalLight shadow color={'white'} position={{ x: -15, y: -45, z: 20 }} intensity={0.5} />
    <HemisphereLight skyColor={'white'} groundColor={'#ac844c'} intensity={0.4} />

    {#each map.linedefs as ld}
        {#each meshes(ld) as mesh}
            <Mesh
                interactive
                on:click={() => hitWall(mesh, ld)}
                position={mesh.position}
                rotation={mesh.rotation}
                geometry={mesh.geometry}
                material={mesh.material}
            />
        {/each}
    {/each}

    {#each sectorMeshes as mesh}
        <Mesh
            interactive
            on:click={() => hitFloor(mesh, mesh.renderSector)}
            position={mesh.position}
            rotation={mesh.rotation}
            geometry={mesh.geometry}
            material={mesh.material}
        />
    {/each}
</Canvas>
