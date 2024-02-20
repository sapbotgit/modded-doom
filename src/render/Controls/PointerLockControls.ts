import type { Action } from 'svelte/action';
import { writable } from 'svelte/store';

interface Params { }
interface Attributes { }

export function createPointerLockControls() {
    let element: HTMLElement;

    const hasTouchControls = matchMedia('(hover: none)').matches;
    let lockResolve: () => void;
    let isPointerLocked = writable(false);
    let setLockState = (val: boolean) => {
        isPointerLocked.set(val);
        lockResolve?.();
        lockResolve = null;
    }

    const releaseLock = () => document.exitPointerLock();
    const requestLock = () => new Promise<void>(resolve => {
        lockResolve = resolve;
        if (hasTouchControls) {
            setLockState(true);
        } else {
            element.requestPointerLock();
        }
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
