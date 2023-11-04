<script lang="ts">
    import { Box3, Frustum, Matrix4, MeshStandardMaterial, Object3D, PlaneGeometry, Raycaster, Texture, Vector2, Vector3 } from "three";
    import { MapObjectIndex } from "../../doom";
    import { tweened, type Tweened } from "svelte/motion";
    import { Mesh, OrthographicCamera, useFrame, useThrelte } from "@threlte/core";
    import { useDoom, useDoomMap } from "../DoomContext";

    export let yScale: number;

    const ctx = useThrelte();
    const { textures } = useDoom();
    const { map, renderSectors } = useDoomMap();
    const { position: cameraPosition, rotation: cameraRotation, zoom } = map.camera;
    $: scale = ($zoom / 1000) + .25;

    const { weapon } = map.player;
    $: sprite = $weapon.sprite;
    const weaponMat = new MeshStandardMaterial({ alphaTest: .5, opacity: 0.5, transparent: true });
    $: frames = map.game.wad.spriteFrames($sprite.name);
    let tx: Texture;
    $: if (frames.length) {
        tx = textures.get(frames[0][0].name, 'sprite');
        weaponMat.map = tx;
    }
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
        hits.clear();
        playerDist = Infinity;

        // surely there is a better way than 8 ray traces :(
        // traceHits(vec.set(0, 0)); // this trace often hits the floor we are standing on which is annoying
        traceHits(vec.set(0, .1));
        traceHits(vec.set(0, .2));
        traceHits(vec.set(-.05, 0));
        traceHits(vec.set(-.05, .2));
        traceHits(vec.set(-.1, 0.1));
        traceHits(vec.set(.05, 0));
        traceHits(vec.set(.05, .2));
        traceHits(vec.set(.1, .1));

        tweens.forEach((tween, obj) => {
            if (!hits.has(obj)) {
                tween.set(1).then(() => tweens.delete(obj));
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
            } else if (int.distance > playerDist) {
                break; // gone too far
            }
            if ('material' in int.object && int.object.material instanceof MeshStandardMaterial) {
                let mat = int.object.material;
                if (int.object.material.alphaTest === 0) {
                    hits.add(int.object);
                    const t = tweens.get(int.object) ?? tweened(1);
                    t.set(0.4, { duration: 60 });
                    t.subscribe(v => mat.opacity = v);
                    tweens.set(int.object, t);
                }
            }
        }
    }
</script>

<OrthographicCamera
    rotation={$cameraRotation}
    position={$cameraPosition}
    scale={{ x: scale, y: scale * yScale }}
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
