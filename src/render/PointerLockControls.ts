// A copy of three/examples/jsm/controls/PointerLockControls
// but tweaked such that z-axis is up/down
//
// See also:
// - https://github.com/mrdoob/three.js/blob/master/examples/misc_controls_pointerlock.html
// - https://threlte.xyz/playground/camera/pointer-lock-controls
// - https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
// - https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/FlyControls.js
import type { Action } from 'svelte/action';
import type { ControllerInput } from '../doom';

interface PointerLockControlsParams {
    input: ControllerInput;
}
export const pointerLockControls: Action<HTMLElement, PointerLockControlsParams> =
(node, params) => {
    const doc = node.ownerDocument;
    let { input } = params;

    node.addEventListener('click', () => node.requestPointerLock());
    doc.addEventListener('pointerlockchange', pointerlockchange);
    doc.addEventListener('pointerlockerror', pointerlockerror);

    const update = (params: PointerLockControlsParams) => {
        input = params.input;
    };
    const destroy = () => {
        unlock();
        doc.removeEventListener('pointerlockchange', pointerlockchange);
        doc.removeEventListener('pointerlockerror', pointerlockerror);
    }
    return { update, destroy };

    function keydown(ev: KeyboardEvent) {
        switch (ev.code) {
            case "Digit1":
                input.weaponSelect = 1;
                break;
            case "Digit2":
                input.weaponSelect = 2;
                break;
            case "Digit3":
                input.weaponSelect = 3;
                break;
            case "Digit4":
                input.weaponSelect = 4;
                break;
            case "Digit5":
                input.weaponSelect = 5;
                break;
            case "Digit6":
                input.weaponSelect = 6;
                break;
            case "Digit7":
                input.weaponSelect = 7;
                break;

            case "KeyE":
            case "Space":
                input.use = true;
                break;

            case "ArrowUp":
            case "KeyW":
                input.moveForward = true;
                break;

            case "ArrowLeft":
            case "KeyA":
                input.moveLeft = true;
                break;

            case "ArrowDown":
            case "KeyS":
                input.moveBackward = true;
                break;

            case "ArrowRight":
            case "KeyD":
                input.moveRight = true;
                break;

            case 'ShiftLeft':
            case 'ShiftRight':
                input.run = true;
                break;

            case 'AltLeft':
            case 'AltRight':
                input.slow = true;
                break;
        }
    }

    function keyup(ev: KeyboardEvent) {
        switch (ev.code) {
            case "KeyE":
            case "Space":
                input.use = false;
                break;

            case "ArrowUp":
            case "KeyW":
                input.moveForward = false;
                break;

            case "ArrowLeft":
            case "KeyA":
                input.moveLeft = false;
                break;

            case "ArrowDown":
            case "KeyS":
                input.moveBackward = false;
                break;

            case "ArrowRight":
            case "KeyD":
                input.moveRight = false;
                break;

            case 'ShiftLeft':
            case 'ShiftRight':
                input.run = false;
                break;

            case 'AltLeft':
            case 'AltRight':
                input.slow = false;
                break;
        }
    }

    function mousemove(ev: MouseEvent) {
        input.mouse.x += ev.movementX;
        input.mouse.y += ev.movementY;
    }

    function mousedown(ev: MouseEvent) {
        if (ev.buttons & 1) {
            input.attack = true;
        }
    }

    function mouseup(ev: MouseEvent) {
        if ((ev.buttons & 1) === 0) {
            input.attack = false;
        }
    }

    function lock() {
        doc.addEventListener('keydown', keydown);
        doc.addEventListener('keyup', keyup);
        doc.addEventListener('mousemove', mousemove);
        doc.addEventListener('mousedown', mousedown);
        doc.addEventListener('mouseup', mouseup);
    }

    function unlock() {
        doc.removeEventListener('keydown', keydown);
        doc.removeEventListener('keyup', keyup);
        doc.removeEventListener('mousemove', mousemove);
        doc.removeEventListener('mousedown', mousedown);
        doc.removeEventListener('mouseup', mouseup);
    }

    function pointerlockchange(ev: Event) {
        if (document.pointerLockElement === node) {
            lock()
        } else {
            unlock();
        }
    }

    function pointerlockerror(ev: Event) {
        console.warn('pointer lock error', ev)
    }
};
