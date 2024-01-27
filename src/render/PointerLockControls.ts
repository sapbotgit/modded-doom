import type { Action } from 'svelte/action';
import { store, type ControllerInput } from '../doom';

interface Params {
    input: ControllerInput;
}
interface Attributes {
}

export function createPointerLockControls() {
    let pointerLockState = store(false);
    let element: HTMLElement;

    const requestLock = () => element.requestPointerLock();
    const releaseLock = () => document.exitPointerLock();
    const pointerLockControls: Action<HTMLElement, Params, Attributes> = (node, params) => {
        const doc = node.ownerDocument;
        let { input } = params;
        element = node;

        doc.addEventListener('pointerlockchange', pointerlockchange);
        doc.addEventListener('pointerlockerror', pointerlockerror);

        const update = (params: Params) => {
            input = params.input;
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
            if (pointerLockState.val) {
                return;
            }
            pointerLockState.set(true);
            doc.addEventListener('mousemove', mousemove);
            doc.addEventListener('mousedown', mousedown);
            doc.addEventListener('mouseup', mouseup);
            doc.addEventListener('wheel', wheel);
        }

        function unlock() {
            pointerLockState.set(false);
            doc.removeEventListener('mousemove', mousemove);
            doc.removeEventListener('mousedown', mousedown);
            doc.removeEventListener('mouseup', mouseup);
            doc.removeEventListener('wheel', wheel);
        }

        function pointerlockchange(ev: Event) {
            if (document.pointerLockElement === node) {
                lock();
            } else {
                unlock();
            }
        }

        function pointerlockerror(ev: Event) {
            console.warn('pointer lock error', ev);
            unlock();
        }
    };

    return { pointerLockControls, requestLock, releaseLock, pointerLockState };
}
