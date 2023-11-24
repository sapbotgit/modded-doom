<script lang="ts">
    import { Box3, Frustum, Matrix4, MeshStandardMaterial, Object3D, PlaneGeometry, Raycaster, Texture, Vector2, Vector3 } from "three";
    import { HALF_PI, MapObjectIndex } from "../../../doom";
    import { tweened, type Tweened } from "svelte/motion";
    import { Mesh, OrthographicCamera, useFrame, useThrelte } from "@threlte/core";
    import { useDoom, useDoomMap } from "../../DoomContext";

    export let yScale: number;

    let zoom = 100; // TODO: is this a reasonable default?
    const { textures } = useDoom();
    const { map, renderSectors, camera } = useDoomMap();
    const { position: playerPosition, direction: yaw } = map.player;

    const rotation = camera.angle;
    $: $rotation.x = HALF_PI * 3 / 4;
    $: $rotation.z = $yaw - HALF_PI;

    const position = camera.position;
    $: $position.x = -Math.sin(-$rotation.z) * 300 + $playerPosition.x;
    $: $position.y = -Math.cos(-$rotation.z) * 300 + $playerPosition.y;
    $: $position.z = Math.cos($rotation.x) * 400 + $playerPosition.z + 41;

    const scale = { x: 1, y: 1 };
    $: scale.x = (zoom / 1000) + .25;
    $: scale.y = scale.x * yScale;

    const weaponMat = new MeshStandardMaterial({ alphaTest: 1 });
    const { weapon } = map.player;
    $: sprite = $weapon.sprite;
    $: frames = map.game.wad.spriteFrames($sprite.name);
    let tx: Texture;
    $: if (frames.length) {
        tx = textures.get(frames[0][0].name, 'sprite');
        weaponMat.map = tx;
    }
    const ctx = useThrelte();
    const screenSize = ctx.size;
    $: weaponPosition = {
        x: (-$screenSize.width + tx.userData.width) * .5,
        y: (-$screenSize.height + tx.userData.height) * .5,
        z: -10,
    }

    const rayCaster = new Raycaster();
    const vec = new Vector2(0, 0);
    let playerDist: number;

    const frustum = new Frustum();
    const bboxMin = new Vector3();
    const bboxMax = new Vector3();
    const bbox = new Box3(bboxMin, bboxMax);
    const matrix = new Matrix4();
    const cam = ctx.camera;
    // tweens keeps track of all active transparent objts and hits keeps track of the ones that are blocking the player
    // this frame. If we have a tween that is not blocking the player, start removing it
    const tweens = new Map<Object3D, Tweened<number>>();
    const hits = new Set<Object3D>();
    useFrame(() => {
        zoom = Math.max(50, Math.min(1000, zoom + map.game.input.aim.z));
        map.game.input.aim.setZ(0);

        hits.clear();
        playerDist = Infinity;

        // convert player bounds to screen bounds
        const radius2x = map.player.info.radius * 2;
        matrix.identity().multiplyMatrices($cam.projectionMatrix, $cam.matrixWorldInverse);
        // make x-dimension a little wider
        bboxMin.set(map.player.position.val.x - radius2x, map.player.position.val.y - map.player.info.radius, map.player.position.val.z);
        bboxMax.set(map.player.position.val.x + radius2x, map.player.position.val.y + map.player.info.radius, map.player.position.val.z + map.player.info.height);
        // shrink the box a little so our traces don't hit the floor
        bbox.expandByScalar(-10);
        bbox.applyMatrix4(matrix);

        // surely there is a better way than 8 ray traces :(
        const midX = (bboxMin.x + bboxMax.x) * .5;
        const midY = (bboxMin.y + bboxMax.y) * .5;
        // only trace top and middle for x-middle
        traceHits(vec.set(midX, midY));
        traceHits(vec.set(midX, bboxMax.y));
        // left edge
        traceHits(vec.set(bboxMin.x, bboxMin.y));
        traceHits(vec.set(bboxMin.x, midY));
        traceHits(vec.set(bboxMin.x, bboxMax.y));
        // right edge
        traceHits(vec.set(bboxMax.x, bboxMin.y));
        traceHits(vec.set(bboxMax.x, midY));
        traceHits(vec.set(bboxMax.x, bboxMax.y));

        tweens.forEach((tween, obj) => {
            if (!hits.has(obj)) {
                tween.set(1, { duration: 1000 }).then(() => tweens.delete(obj));
            }
        });

        // // FIXME: the following isn't behaving as I would expect. Need something better. PLUS we'll need mobjs to hide/show
        // // based on their render sector which we don't do now
        // // mark all sectors as hidden
        // renderSectors.forEach(rs => rs.visible.set(false));
        // // show reachable sectors
        // matrix.identity().multiplyMatrices($cam.projectionMatrix, $cam.matrixWorldInverse);
        // frustum.setFromProjectionMatrix(matrix);
        // const psec = renderSectors.find(rs => rs.sector === map.player.sector.val);
        // const q = [psec];
        // // console.log('start')
        // let vc = 0;
        // while (q.length) {
        //     const rs = q.shift();
        //     if (rs.visible.val) {
        //         continue;
        //     }
        //     const visible = rs.portalSegs.reduce((vis, seg) => {
        //         bboxMin.set(seg.v[0].x, seg.v[0].y, rs.sector.zFloor.val);
        //         bboxMax.set(seg.v[1].x, seg.v[1].y, rs.sector.zCeil.val);
        //         // bboxMin.set(Math.min(seg.v[0].x, seg.v[1].x), Math.min(seg.v[0].y, seg.v[1].y), rs.sector.zFloor.val);
        //         // bboxMax.set(Math.max(seg.v[0].x, seg.v[1].x), Math.max(seg.v[0].y, seg.v[1].y), rs.sector.zCeil.val);
        //         return vis || frustum.intersectsBox(bbox);
        //     }, false)
        //     if (!visible || rs.sector.zCeil.val - rs.sector.zFloor.val <= 0.001 ) {
        //         continue;
        //     }
        //     // if (!rs.geometry || !frustum.intersectsBox(rs.geometry.boundingBox)) {
        //     //     continue;
        //     // }
        //     vc++
        //     rs.visible.set(true);
        //     // map.data.sectorNeighbours(rs.sector).forEach(sec => q.push(renderSectors.find(rs => rs.sector === sec)));
        //     // check floor ceiling height for closed doors?
        //     rs.portalSegs.forEach(seg => {
        //         q.push(renderSectors.find(rs => rs.sector === seg.linedef.right.sector))
        //         q.push(renderSectors.find(rs => rs.sector === seg.linedef.left?.sector))
        //     });
        // }
        // // console.log('vis',vc)
    });

    function traceHits(screenPosition: Vector2) {
        rayCaster.setFromCamera(screenPosition, $cam);
        const ints = rayCaster.intersectObjects(ctx.scene.children, false);
        for (const int of ints) {
            if ('moType' in int.object.userData && int.object.userData.moType === MapObjectIndex.MT_PLAYER) {
                playerDist = int.distance;
                break; // stop here
            } else if (int.distance >= playerDist) {
                break; // gone too far
            }
            if ('material' in int.object && int.object.material instanceof MeshStandardMaterial) {
                let mat = int.object.material;
                if (int.object.material.alphaTest === 0) {
                    hits.add(int.object);
                    const t = tweens.get(int.object) ?? tweened(1);
                    t.set(0.3, { duration: 60 });
                    t.subscribe(v => mat.opacity = v);
                    tweens.set(int.object, t);
                }
            }
        }
    }
</script>

<OrthographicCamera
    rotation={$rotation}
    position={$position}
    {scale}
    far={100000}
>
    {#if tx}
        <Mesh
            position={weaponPosition}
            scale={{ x: tx.userData.width, y: tx.userData.height }}
            material={weaponMat}
            geometry={new PlaneGeometry()}
        />
    {/if}
</OrthographicCamera>
