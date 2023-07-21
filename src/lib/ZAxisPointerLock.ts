// A copy of three/examples/jsm/controls/PointerLockControls
// but tweaked such that z-axis is up/down
//
// See also:
// - https://github.com/mrdoob/three.js/blob/master/examples/misc_controls_pointerlock.html
// - https://threlte.xyz/playground/camera/pointer-lock-controls
// - https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
// - https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/FlyControls.js
import type { Action } from 'svelte/action';
import type { DoomGame } from '../doom';

interface PointerLockControlsParams {
    game: DoomGame;
}
export const pointerLockControls: Action<HTMLElement, PointerLockControlsParams> =
(node, params) => {
    const doc = node.ownerDocument;
    let { game } = params;

    node.addEventListener('click', () => node.requestPointerLock());
    doc.addEventListener('pointerlockchange', pointerlockchange);
    doc.addEventListener('pointerlockerror', pointerlockerror);

    const update = (params: PointerLockControlsParams) => {
        game = params.game;
    };
    const destroy = () => {
        unlock();
        doc.removeEventListener('pointerlockchange', pointerlockchange);
        doc.removeEventListener('pointerlockerror', pointerlockerror);
    }
    return { update, destroy };

    function keydown(ev: KeyboardEvent) {
        switch (ev.code) {
            case "KeyE":
            case "Space":
                game.input.use = true;
                break;

            case "ArrowUp":
            case "KeyW":
                game.input.moveForward = true;
                break;

            case "ArrowLeft":
            case "KeyA":
                game.input.moveLeft = true;
                break;

            case "ArrowDown":
            case "KeyS":
                game.input.moveBackward = true;
                break;

            case "ArrowRight":
            case "KeyD":
                game.input.moveRight = true;
                break;

            case 'ShiftLeft':
            case 'ShiftRight':
                game.input.run = true;
                break;

            case 'AltLeft':
            case 'AltRight':
                game.input.slow = true;
                break;
        }
    }

    function keyup(ev: KeyboardEvent) {
        switch (ev.code) {
            case "KeyE":
            case "Space":
                game.input.use = false;
                break;

            case "ArrowUp":
            case "KeyW":
                game.input.moveForward = false;
                break;

            case "ArrowLeft":
            case "KeyA":
                game.input.moveLeft = false;
                break;

            case "ArrowDown":
            case "KeyS":
                game.input.moveBackward = false;
                break;

            case "ArrowRight":
            case "KeyD":
                game.input.moveRight = false;
                break;

            case 'ShiftLeft':
            case 'ShiftRight':
                game.input.run = false;
                break;

            case 'AltLeft':
            case 'AltRight':
                game.input.slow = false;
                break;
        }
    }

    function mousemove(ev: MouseEvent) {
        game.input.mouse.x += ev.movementX;
        game.input.mouse.y += ev.movementY;
    }

    function lock() {
        doc.addEventListener('keydown', keydown);
        doc.addEventListener('keyup', keyup);
        doc.addEventListener('mousemove', mousemove);
    }

    function unlock() {
        doc.removeEventListener('keydown', keydown);
        doc.removeEventListener('keyup', keyup);
        doc.removeEventListener('mousemove', mousemove);
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
