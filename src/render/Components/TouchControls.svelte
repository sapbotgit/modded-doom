<script lang="ts">
    import type { EventHandler } from "svelte/elements";
    import type { ControllerInput, MapRuntime } from "../../doom";
    import RoundMenu from "./RoundMenu.svelte";
    import type { Vector3 } from "three";
    import type { Action, ActionReturn } from "svelte/action";

    export let map: MapRuntime;
    $: game = map.game;
    $: player = map.player;

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

    const touchMoveControls: Action<HTMLElement, Params, Attributes> = (node, params): ActionReturn<Params, Attributes> => {
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

    const touchLookControls: Action<HTMLElement, Params, Attributes> = (node, params): ActionReturn<Params, Attributes> => {
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

    let showWeaponMenu = false;
    function weaponWheelTouchMove(ev: TouchEvent) {
        const btn = document.elementFromPoint(ev.changedTouches[0].clientX, ev.changedTouches[0].clientY)
        if (btn instanceof HTMLButtonElement && btn.getAttribute('class').includes('wbutton')) {
            btn.focus()
        }
    }

    function weaponWheelTouchEnd(ev: TouchEvent) {
        const btn = document.elementFromPoint(ev.changedTouches[0].clientX, ev.changedTouches[0].clientY)
        if (btn instanceof HTMLButtonElement && btn.getAttribute('class').includes('wbutton')) {
            btn.click();
        }
        showWeaponMenu = false
    }

    const selectWeapon = (num: number) => () => {
        if (player.weapon.val.name !== player.inventory.val.weapons[num].name) {
            player.nextWeapon = player.inventory.val.weapons[num];
        }
    }

    type Point = { x: number, y: number };
    let movePoint = { x: 0, y: 0 };
    let lookPoint = { x: 0, y: 0 };
    const touchPoint = (point: Point, ev: CustomEvent<Vector3>) => {
        point.x = (ev.detail.x + 1) * 50;
        point.y = (ev.detail.y + 1) * 50;
        return point;
    };
</script>

<div class="absolute bottom-16 px-4 w-full flex justify-between">
    <div
        use:touchMoveControls={game}
        on:touch-active={ev => movePoint = touchPoint(movePoint, ev)}
        style="--px:{movePoint.x}%; --py:{100 - movePoint.y}%"
        class="touchGradient border-2 border-primary-content w-40 h-40 rounded-full"
    />
    <div
        class="touchGradient w-32 h-32 rounded-full relative top-16"
        style="--px:50%; --py:50%;"
        on:touchstart|preventDefault={() => showWeaponMenu = true}
        on:touchmove|preventDefault={weaponWheelTouchMove}
        on:touchend={weaponWheelTouchEnd}
        on:touchcancel={() => showWeaponMenu = false}
    />
    <div
        use:touchLookControls={game}
        on:touch-active={ev => lookPoint = touchPoint(lookPoint, ev)}
        style="--px:{lookPoint.x}%; --py:{lookPoint.y}%"
        class="touchGradient border-2 border-primary-content w-40 h-40 rounded-full"
    />
</div>
{#if showWeaponMenu}
    <div class="absolute flex justify-center items-center w-full bottom-0">
        <div class="absolute w-[30%] translate-y-[-75%] top-0 overflow-hidden">
            <RoundMenu spanAngle={360} let:num let:rotation>
                <button
                    disabled={!player.inventory.val.weapons[num]}
                    class="wbutton btn w-full h-full opacity-80"
                    style="--btn-focus-scale:.9; --rotation:{-rotation}deg;"
                    on:click={selectWeapon(num)}
                >
                    <span class="roundMenuItem top-[40%] right-[5%]">weapon-{num}</span>
                </button>
            </RoundMenu>
        </div>
    </div>
{/if}

<style>
    .touchGradient {
        background-image: radial-gradient(
            circle at var(--px, '50%') var(--py, '50%'),
            oklch(var(--a)), oklch(var(--a)) 25%, transparent 30%);
        opacity: .4;
        transition: opacity .5s;
    }

    .wbutton:focus {
        --btn-color: var(--a);
    }

    .roundMenuItem {
        position: absolute;
        transform: rotate(calc(var(--rotation)));
        pointer-events: none;
    }
</style>