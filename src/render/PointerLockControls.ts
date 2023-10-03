// A copy of three/examples/jsm/controls/PointerLockControls
// but tweaked such that z-axis is up/down
//
// See also:
// - https://github.com/mrdoob/three.js/blob/master/examples/misc_controls_pointerlock.html
// - https://threlte.xyz/playground/camera/pointer-lock-controls
// - https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/PointerLockControls.js
// - https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/FlyControls.js
import type { Action, ActionReturn } from 'svelte/action';
import type { ControllerInput } from '../doom';
import type { EventHandler } from 'svelte/elements';
import { keyboardControls } from './KeyboardControls';

interface Params {
    input: ControllerInput;
    messageNode: HTMLElement;
}
interface Attributes {
    'on:pointer-lock': EventHandler;
    'on:pointer-unlock': EventHandler;
}

export const pointerLockControls: Action<HTMLElement, Params, Attributes> =
(node, params) => {
    const doc = node.ownerDocument;
    let { input, messageNode } = params;

    let keyboardAction: ActionReturn<Params> = null;
    const lockRequest = () => node.requestPointerLock();
    (messageNode ?? node).addEventListener('click', lockRequest);
    doc.addEventListener('pointerlockchange', pointerlockchange);
    doc.addEventListener('pointerlockerror', pointerlockerror);

    const update = (params: Params) => {
        const old = messageNode ?? node;
        messageNode = params.messageNode;
        old.removeEventListener('click', lockRequest);
        (messageNode ?? node).addEventListener('click', lockRequest);

        input = params.input;

        keyboardAction?.update(params);
    };
    const destroy = () => {
        unlock();
        doc.removeEventListener('pointerlockchange', pointerlockchange);
        doc.removeEventListener('pointerlockerror', pointerlockerror);
    }
    return { update, destroy };

    function mousemove(ev: MouseEvent) {
        input.aim.x += ev.movementX;
        input.aim.y += ev.movementY;
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

    function wheel(ev: WheelEvent) {
        input.aim.z += ev.deltaY;
    }

    function lock() {
        keyboardAction = keyboardControls(node, params) as ActionReturn;
        node.dispatchEvent(new CustomEvent('pointer-lock'));
        doc.addEventListener('mousemove', mousemove);
        doc.addEventListener('mousedown', mousedown);
        doc.addEventListener('mouseup', mouseup);
        doc.addEventListener('wheel', wheel);
    }

    function unlock() {
        keyboardAction?.destroy();
        node.dispatchEvent(new CustomEvent('pointer-unlock'));
        doc.removeEventListener('mousemove', mousemove);
        doc.removeEventListener('mousedown', mousedown);
        doc.removeEventListener('mouseup', mouseup);
        doc.removeEventListener('wheel', wheel);
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
