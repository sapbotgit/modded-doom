<script lang="ts">
    import { Canvas, T } from '@threlte/core';
    import TextureMap from './TextureMap.svelte';
    import Stats from './Stats.svelte';
    import { OrbitControls } from '@threlte/extras';
    import { Object3D } from 'three';

    Object3D.DEFAULT_UP.set(0, 0, 1)
</script>
<div class="h-screen w-screen">
    <Canvas>
        <Stats />

        <T.PerspectiveCamera
            makeDefault
            fov={45}
            far={100000}
            position.x={0}
            position.y={75}
            position.z={100}
        >
            <OrbitControls  />
        </T.PerspectiveCamera>

        <T.AmbientLight color={'white'} intensity={2} />

        <TextureMap />
    </Canvas>
</div>
