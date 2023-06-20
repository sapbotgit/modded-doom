<script lang="ts">
    import { DoubleSide, MeshStandardMaterial, PlaneGeometry } from "three";
    import FirstPersonControls from "./FirstPersonControls.svelte";
    import { Canvas, DirectionalLight, HemisphereLight, Mesh, PerspectiveCamera } from "@threlte/core";
    import type { DoomMap, DoomWad, LineDef, SideDef } from "../doomwad";
    import { MapTextures } from "./Texture";

    export let wad: DoomWad;
    export let map: DoomMap;

    let textures = new MapTextures(wad);

    const width = 256;
    const height = 128;
    // let texture = textures.get('SUPPORT2');
    // let texture = textures.get('COMPOHSO');
    // let texture = textures.get('STARTAN3');
    // let texture = textures.get('WOOD5');
    // let texture = textures.get('STARG3');
    // let texture = textures.get('STEP1');
    // let texture = textures.get('GRAY7');
    let texture = textures.get('BROWNGRN');
    const ld: LineDef = {} as any;
    const sd: SideDef = { xOffset: 0, yOffset: 0 } as any;
    const material = new MeshStandardMaterial({
        map: textures.position(texture, width, height, ld, sd, 'middle'),
        side: DoubleSide,
    });
</script>


<Canvas size={{ width: 800, height: 600 }}>
    <PerspectiveCamera far={100000} fov={70}>
        <FirstPersonControls {map} />
    </PerspectiveCamera>

    <DirectionalLight shadow color={'white'} position={{ x: -15, y: 45, z: 20 }} />
    <HemisphereLight skyColor={'white'} groundColor={'#ac844c'} intensity={0.4} />

    <Mesh
        position={{ x: 0, y: 40, z: -150 }}
        geometry={new PlaneGeometry(width, height)}
        {material}
    />
</Canvas>