import type { Action } from 'svelte/action';
import { writable } from 'svelte/store';

interface Params { }
interface Attributes { }

export function createPointerLockControls() {
    let element: HTMLElement;

    let lockResolve: () => void;
    let isPointerLocked = writable(false);
    let setLockState = (val: boolean) => {
        isPointerLocked.set(val);
        lockResolve?.();
        lockResolve = null;
    }

    const releaseLock = () => document.exitPointerLock();
    // FIXME: requestPointerLock() does not exist on iOS so this needs to be different. Mobile controls, in general, need to be different
    const requestLock = () => new Promise<void>(resolve => {
        lockResolve = resolve;
        element.requestPointerLock();
    });
    const pointerLockControls: Action<HTMLElement, Params, Attributes> = (node, params) => {
        const doc = node.ownerDocument;
        element = node;

        doc.addEventListener('pointerlockchange', pointerlockchange);
        doc.addEventListener('pointerlockerror', pointerlockerror);

        const update = (params: Params) => {};
        const destroy = () => {
            setLockState(false);
            doc.removeEventListener('pointerlockchange', pointerlockchange);
            doc.removeEventListener('pointerlockerror', pointerlockerror);
        }
        return { update, destroy };

        function pointerlockchange(ev: Event) {
            if (document.pointerLockElement === node) {
                setLockState(true);
            } else {
                setLockState(false);
            }
        }

        function pointerlockerror(ev: Event) {
            console.warn('pointer lock error', ev);
            setLockState(false);
        }
    };

    return { pointerLockControls, requestLock, releaseLock, isPointerLocked };
}
