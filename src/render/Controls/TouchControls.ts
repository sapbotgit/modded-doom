import type { Action, ActionReturn } from 'svelte/action';
import type { ControllerInput } from '../../doom';
import type { EventHandler } from 'svelte/elements';
import { Vector3 } from 'three';

const aimSpeed = 32;
const deadZone = 0.2;
function clipMove(val: number) {
    if (Math.abs(val) < deadZone) {
        return 0;
    }
    const scaled = Math.sign(val) * (Math.abs(val) - deadZone) / (1 - deadZone);
    return Math.max(-1, Math.min(1, scaled));
}

function findTouch(tl: TouchList, id: number) {
    for (let i = 0; i < tl.length; i++) {
        if (tl[i].identifier === id) {
            return tl[i];
        }
    }
    return tl[0];
}

interface Params {
    input: ControllerInput;
}
interface Attributes {
    'on:touch-active': EventHandler<CustomEvent<Vector3>>;
}

export const touchMoveControls: Action<HTMLElement, Params, Attributes> = (node, params): ActionReturn<Params, Attributes> => {
    let { input } = params;

    let touchNum: number;
    let bounds: DOMRect;
    let box = { midX: 0, midY: 0, halfWidth: 0, halfHeight: 0 };
    resize();
    // we should use viewSize (somehow) and subscribe instead of window size in case we want to embed the view in a page and
    // the size may be independent of the window size
    window.addEventListener('resize', resize);

    node.addEventListener('touchstart', touchstart);
    node.addEventListener('touchmove', touchmove);
    node.addEventListener('touchend', touchend);
    const update = (params: Params) => {
        input = params.input;
    };
    const destroy = () => {
        node.removeEventListener('touchstart', touchstart);
        node.removeEventListener('touchmove', touchmove);
        node.removeEventListener('touchend', touchend);
        window.removeEventListener('resize', resize);
    }
    return { update, destroy };

    function resize() {
        bounds = node.getBoundingClientRect();
        box.midX = (bounds.left + bounds.right) * .5;
        box.midY = (bounds.top + bounds.bottom) * .5;
        box.halfWidth = bounds.width * .5;
        box.halfHeight = bounds.height * .5;
    }

    function updateTouch(t: Touch) {
        input.move.x = clipMove((t.clientX - box.midX) / box.halfWidth);
        input.move.y = clipMove(-(t.clientY - box.midY) / box.halfHeight);
        node.dispatchEvent(new CustomEvent<{ x: number, y: number }>('touch-active', { detail: input.move }));
    }

    function touchstart(ev: TouchEvent) {
        touchNum = ev.changedTouches[0].identifier;
        updateTouch(findTouch(ev.touches, touchNum));
    }

    function touchmove(ev: TouchEvent) {
        updateTouch(findTouch(ev.touches, touchNum));
        ev.preventDefault();
    }

    function touchend(ev: TouchEvent) {
        input.move.set(0, 0, 0);
        node.dispatchEvent(new CustomEvent<{ x: number, y: number }>('touch-active', { detail: input.move }));
    }
};

export const touchLookControls: Action<HTMLElement, Params, Attributes> = (node, params): ActionReturn<Params, Attributes> => {
    let { input } = params;

    let touchNum: number;
    let touchActive = false;
    let bounds: DOMRect;
    let box = { midX: 0, midY: 0, halfWidth: 0, halfHeight: 0 };
    let aim = { x: 0, y: 0 };
    resize();
    // we should use viewSize (somehow) and subscribe instead of window size in case we want to embed the view in a page and
    // the size may be independent of the window size
    window.addEventListener('resize', resize);

    node.addEventListener('touchstart', touchstart);
    node.addEventListener('touchmove', touchmove);
    node.addEventListener('touchend', touchend);
    const update = (params: Params) => {
        input = params.input;
    };
    const destroy = () => {
        node.removeEventListener('touchstart', touchstart);
        node.removeEventListener('touchmove', touchmove);
        node.removeEventListener('touchend', touchend);
        window.removeEventListener('resize', resize);
    }
    return { update, destroy };

    function resize() {
        bounds = node.getBoundingClientRect();
        box.midX = (bounds.left + bounds.right) * .5;
        box.midY = (bounds.top + bounds.bottom) * .5;
        box.halfWidth = bounds.width * .5;
        box.halfHeight = bounds.height * .5;
    }

    function touchstart(ev: TouchEvent) {
        touchNum = ev.changedTouches[0].identifier;
        touchActive = true;
        requestAnimationFrame(onTick);
        updateTouch(findTouch(ev.touches, touchNum));
    }

    function touchmove(ev: TouchEvent) {
        updateTouch(findTouch(ev.touches, touchNum));
        ev.preventDefault();
    }

    function touchend(ev: TouchEvent) {
        touchActive = false;
        aim.x = aim.y = 0;
        node.dispatchEvent(new CustomEvent('touch-active', { detail: aim }));
    }

    function updateTouch(t: Touch) {
        aim.x = clipMove((t.clientX - box.midX) / box.halfWidth);
        aim.y = clipMove((t.clientY - box.midY) / box.halfHeight);
        node.dispatchEvent(new CustomEvent('touch-active', { detail: aim }));
    }

    function onTick() {
        input.aim.x = aimSpeed * aim.x;
        input.aim.y = aimSpeed * aim.y;
        if (touchActive) {
            requestAnimationFrame(onTick);
        }
    }
}

export const touchWeaponControls: Action<HTMLElement, Params> = (node, params): ActionReturn => {
    let { input } = params;

    const update = (params: Params) => {
        input = params.input;
    };
    const destroy = () => {
    }
    return { update, destroy };
}