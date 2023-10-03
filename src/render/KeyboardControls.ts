import type { Action, ActionReturn } from 'svelte/action';
import type { ControllerInput } from '../doom';

interface Params {
    input: ControllerInput;
}

export const keyboardControls: Action<HTMLElement, Params> =
(node, params): ActionReturn => {
    const doc = node.ownerDocument;
    let { input } = params;

    const moveKeys = {
        left: 0,
        right: 0,
        up: 0,
        down: 0,
        forward: 0,
        backward: 0,
    }
    function movementFromKeyboard() {
        input.move.set(
            moveKeys.left + moveKeys.right,
            moveKeys.forward + moveKeys.backward,
            moveKeys.up + moveKeys.down
        );
    }

    doc.addEventListener('keydown', keydown);
    doc.addEventListener('keyup', keyup);
    const update = (params: Params) => {
        input = params.input;
    };
    const destroy = () => {
        doc.removeEventListener('keydown', keydown);
        doc.removeEventListener('keyup', keyup);
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

            case "KeyR":
                moveKeys.up = 1;
                break;
            case "KeyT":
                moveKeys.down = -1;
                break;

            case "ArrowUp":
            case "KeyW":
                moveKeys.forward = 1;
                break;

            case "ArrowDown":
            case "KeyS":
                moveKeys.backward = -1;
                break;

            case "ArrowLeft":
            case "KeyA":
                moveKeys.left = -1;
                break;

            case "ArrowRight":
            case "KeyD":
                moveKeys.right = 1;
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
        movementFromKeyboard();
    }

    function keyup(ev: KeyboardEvent) {
        switch (ev.code) {
            case "KeyE":
            case "Space":
                input.use = false;
                break;

            case "ArrowUp":
            case "KeyW":
                moveKeys.forward = 0;
                break;
            case "ArrowDown":
            case "KeyS":
                moveKeys.backward = 0;
                break;

            case "ArrowLeft":
            case "KeyA":
                moveKeys.left = 0;
                break;
            case "ArrowRight":
            case "KeyD":
                moveKeys.right = 0;
                break;

            case "KeyR":
                moveKeys.up = 0;
            case "KeyT":
                moveKeys.down = 0;
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
        movementFromKeyboard();
    }
};
