import type { Action } from 'svelte/action';
import { writable } from 'svelte/store';

export function createFullscreenControls() {
    let element: HTMLElement;

    let isFullscreen = writable(false);

    const releaseFullscreen = () => document.exitFullscreen();
    const requestFullscreen = () => {
        const hasFullScreenControls = typeof element?.requestFullscreen === 'function';
        return hasFullScreenControls ? element.requestFullscreen() : Promise.resolve(true);
    }

    const fullscreenControls: Action<HTMLElement> = (node) => {
        const doc = node.ownerDocument;
        element = node;

        doc.addEventListener('fullscreenchange', change);
        doc.addEventListener('fullscreenerror', error);

        const destroy = () => {
            isFullscreen.set(false);
            doc.removeEventListener('fullscreenchange', change);
            doc.removeEventListener('fullscreenerror', error);
        }
        return { destroy };

        function change(ev: Event) {
            isFullscreen.set(document.fullscreenElement === node);
        }

        function error(ev: Event) {
            console.warn('full screen error', ev);
            isFullscreen.set(false);
        }
    };

    return { fullscreenControls, requestFullscreen, releaseFullscreen, isFullscreen };
}
