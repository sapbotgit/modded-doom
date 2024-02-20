import type { Action, ActionReturn } from 'svelte/action';
import type { ControllerInput } from '../../doom';

interface Params {
    input: ControllerInput;
}

export const mouseControls: Action<HTMLElement, Params> =
(node, params): ActionReturn => {
    const doc = node.ownerDocument;
    let { input } = params;

    doc.addEventListener('mousemove', mousemove);
    doc.addEventListener('mousedown', mousedown);
    doc.addEventListener('mouseup', mouseup);
    doc.addEventListener('wheel', wheel);
    const update = (params: Params) => {
        input = params.input;
    };
    const destroy = () => {
        doc.removeEventListener('mousemove', mousemove);
        doc.removeEventListener('mousedown', mousedown);
        doc.removeEventListener('mouseup', mouseup);
        doc.removeEventListener('wheel', wheel);
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
        if (!(ev.buttons & 1)) {
            input.attack = false;
        }
    }

    function wheel(ev: WheelEvent) {
        input.aim.z += ev.deltaY;
    }
};
