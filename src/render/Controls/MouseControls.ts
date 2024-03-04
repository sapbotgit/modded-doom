import type { Action, ActionReturn } from 'svelte/action';
import type { ControllerInput } from '../../doom';

interface Params {
    input: ControllerInput;
    mouseSpeed: number;
    invertY: boolean;
    swapButtons: boolean;
}

export const mouseControls: Action<HTMLElement, Params> =
(node, params): ActionReturn => {
    const doc = node.ownerDocument;
    let { input, mouseSpeed } = params;
    let yMul = 0;
    let buttonProps = {};

    const update = (params: Params) => {
        input = params.input;
        mouseSpeed = params.mouseSpeed;
        yMul = params.invertY ? -1 : 1;
        if (params.swapButtons) {
            buttonProps[1] = 'use';
            buttonProps[2] = 'attack';
        } else {
            buttonProps[1] = 'attack';
            buttonProps[2] = 'use';
        }
    };
    update(params);

    doc.addEventListener('mousemove', mousemove);
    doc.addEventListener('mousedown', mousedown);
    doc.addEventListener('mouseup', mouseup);
    doc.addEventListener('wheel', wheel);
    const destroy = () => {
        doc.removeEventListener('mousemove', mousemove);
        doc.removeEventListener('mousedown', mousedown);
        doc.removeEventListener('mouseup', mouseup);
        doc.removeEventListener('wheel', wheel);
    }
    return { update, destroy };

    function mousemove(ev: MouseEvent) {
        input.aim.x += ev.movementX * mouseSpeed;
        input.aim.y += ev.movementY * mouseSpeed * yMul;
    }

    function mousedown(ev: MouseEvent) {
        if (ev.buttons & 1) {
            input[buttonProps[1]] = true;
        }
        if (ev.buttons & 2) {
            input[buttonProps[2]] = true;
        }
    }

    function mouseup(ev: MouseEvent) {
        if (!(ev.buttons & 1)) {
            input[buttonProps[1]] = false;
        }
        if (!(ev.buttons & 2)) {
            input[buttonProps[2]] = false;
        }
    }

    function wheel(ev: WheelEvent) {
        input.aim.z += ev.deltaY * mouseSpeed;
    }
};
