<script lang="ts">
    // very losely based on
    // - https://github.com/mrdoob/three.js/blob/master/examples/misc_controls_pointerlock.html
    // - https://threlte.xyz/playground/camera/pointer-lock-controls
    // See also:
    // - https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
    // - https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/FlyControls.js
    import { AlwaysStencilFunc, Camera, Object3D, Vector3 } from "three";
    import {
        DisposableObject,
        TransformableObject,
        useFrame,
        useParent,
        useThrelte,
    } from "@threlte/core";
    import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
    import type { DoomMap } from "../doomwad";
    import { useDoom } from "./useDoom";
    import { HALF_PI } from "./Math";
    import { get } from "svelte/store";

    const parent = useParent();
    const { renderer } = useThrelte();
    if (!renderer)
        throw new Error(
            "Threlte Context missing: Is <OrbitControls> a child of <Canvas>?"
        );
    if (!($parent instanceof Camera)) {
        throw new Error(
            "Parent missing: <OrbitControls> need to be a child of a <Camera>"
        );
    }

    export let map: DoomMap;
    export const controls = new PointerLockControls($parent, document.body);

    const { game } = useDoom();

    const freeFly = true;
    const canLookUp = true;

    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;
    let run = false;
    let canJump = false;

    const velocity = new Vector3();
    const direction = new Vector3();

    const keydown = (event) => {
        switch (event.code) {
            case "ArrowUp":
            case "KeyW":
                moveForward = true;
                break;

            case "ArrowLeft":
            case "KeyA":
                moveLeft = true;
                break;

            case "ArrowDown":
            case "KeyS":
                moveBackward = true;
                break;

            case "ArrowRight":
            case "KeyD":
                moveRight = true;
                break;

            case 'ShiftLeft':
            case 'ShiftRight':
                run = true;
                break;

            case "Space":
                if (canJump === true) velocity.y += 350;
                canJump = false;
                break;
        }
    };

    const keyup = (event) => {
        switch (event.code) {
            case "ArrowUp":
            case "KeyW":
                moveForward = false;
                break;

            case "ArrowLeft":
            case "KeyA":
                moveLeft = false;
                break;

            case "ArrowDown":
            case "KeyS":
                moveBackward = false;
                break;

            case "ArrowRight":
            case "KeyD":
                moveRight = false;
                break;

            case 'ShiftLeft':
            case 'ShiftRight':
                run = false;
                break;
        }
    };

    let vec = new Vector3();
    const domRoot = renderer.domElement;
    const lockElement = domRoot//document.getElementById('lock-message');
    lockElement.addEventListener( 'click', function () {
        controls.lock();
    });
    // controls.addEventListener('lock', () => lockElement.style.display = 'none');
    // controls.addEventListener('unlock', () => lockElement.style.display = 'block');

    if (!canLookUp) {
        controls.maxPolarAngle = HALF_PI;
        controls.minPolarAngle = HALF_PI;
    }

    // HACK ALERT: the game should know the player position and the UI "react" to that.
    game.playerPosition.set(controls.camera.position);
    vec.copy(controls.getDirection(vec));
    game.playerDirection.set(Math.atan2(-vec.z, vec.x) - HALF_PI);

    useFrame((ctx, delta) => {
        if (controls.isLocked === true) {
            velocity.x -= velocity.x * 5.0 * delta;
            velocity.z -= velocity.z * 5.0 * delta;

            velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

            direction.z = Number(moveForward) - Number(moveBackward);
            direction.x = Number(moveRight) - Number(moveLeft);
            direction.normalize(); // ensure consistent movements in all directions

            const speed = run ? 8000.0 : 4000.0
            if (moveForward || moveBackward)
                velocity.z -= direction.z * speed * delta;
            if (moveLeft || moveRight)
                velocity.x -= direction.x * speed * delta;

            controls.moveRight(-velocity.x * delta);
            // freelook https://stackoverflow.com/questions/63405094
            // controls.moveForward(-velocity.z * delta);
            const camera = controls.camera;
            vec.copy(controls.getDirection(vec));
            camera.position.addScaledVector(vec, -velocity.z * delta);

            // HACK ALERT: the game should know the player position and the UI "react" to that.
            game.playerPosition.set(camera.position);
            game.playerDirection.set(Math.atan2(-vec.z, vec.x) - HALF_PI);

            const sector = map.findSector(camera.position.x, -camera.position.z);
            if (sector && !freeFly) {
                controls.getObject().position.y = get(sector.zFloor) + 41;
            }

            // gravity?
            // controls.getObject().position.y += ( velocity.y * delta ); // new behavior
            // if ( controls.getObject().position.y < 10 ) {
            //     velocity.y = 0;
            //     controls.getObject().position.y = 10;
            //     canJump = true;
            // }
        }
    });
</script>

<svelte:window
    on:keydown={keydown}
    on:keyup={keyup}
/>

<DisposableObject object={controls} />
