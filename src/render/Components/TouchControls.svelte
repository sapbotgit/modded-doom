<script lang="ts">
    import type { EventHandler } from "svelte/elements";
    import type { ControllerInput, MapRuntime } from "../../doom";
    import RoundMenu from "./RoundMenu.svelte";
    import type { Vector3 } from "three";
    import type { Action, ActionReturn } from "svelte/action";
    import Picture from "./Picture.svelte";
    import type { Size } from "@threlte/core";

    export let map: MapRuntime;
    export let viewSize: Size;
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

    $: touchParams = { input: game.input, viewSize };
    type Params = typeof touchParams;
    interface Attributes {
        'on:touch-active': EventHandler<CustomEvent<Vector3>>;
    }

    const touchMoveControls: Action<HTMLElement, Params, Attributes> = (node, params): ActionReturn<Params, Attributes> => {
        let { input } = params;

        let touchNum: number;
        let bounds: DOMRect;
        let box = { midX: 0, midY: 0, halfWidth: 0, halfHeight: 0 };
        resize();

        node.addEventListener('touchstart', touchstart);
        node.addEventListener('touchmove', touchmove);
        node.addEventListener('touchend', touchend);
        const update = (params: Params) => {
            input = params.input;
            resize();
        };
        const destroy = () => {
            node.removeEventListener('touchstart', touchstart);
            node.removeEventListener('touchmove', touchmove);
            node.removeEventListener('touchend', touchend);
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

        node.addEventListener('touchstart', touchstart);
        node.addEventListener('touchmove', touchmove);
        node.addEventListener('touchend', touchend);
        const update = (params: Params) => {
            input = params.input;
            resize();
        };
        const destroy = () => {
            node.removeEventListener('touchstart', touchstart);
            node.removeEventListener('touchmove', touchmove);
            node.removeEventListener('touchend', touchend);
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

    const weaponSprites: [string, number, number][] = [
        ['PUNGB0', 26, -5],
        ['SAWGC0', 23, -10],
        ['PISGA0', 25, 0],
        ['SHTGA0', 29, 0],
        ['SHT2A0', 27, 8],
        ['CHGGA0', 14, 0],
        ['MISGB0', 13, -5],
        ['PLSGA0', 17, -7],
        ['BFGGA0', 9, -11],
    ];
    if (!map.game.wad.spriteTextureData('SHT2A0')) {
        weaponSprites.splice(4, 1);
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
        use:touchMoveControls={touchParams}
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
        use:touchLookControls={touchParams}
        on:touch-active={ev => lookPoint = touchPoint(lookPoint, ev)}
        style="--px:{lookPoint.x}%; --py:{lookPoint.y}%"
        class="touchGradient border-2 border-primary-content w-40 h-40 rounded-full"
    />
</div>

{#if showWeaponMenu}
    <div class="absolute flex justify-center items-center w-full bottom-0">
        <div class="absolute w-[30%] translate-y-[-75%] top-0 overflow-hidden">
            <RoundMenu slices={weaponSprites.length} spanAngle={360} let:num let:rotation>
                <button
                    disabled={!player.inventory.val.weapons[num]}
                    class="wbutton btn no-animation w-full h-full opacity-80"
                    style="--btn-focus-scale:.9; --rotation:{-rotation}deg;"
                    on:click={selectWeapon(num)}
                    on:touchend={() => showWeaponMenu = false}
                >
                    <span
                        class="roundMenuItem"
                        class:hidden={!player.inventory.val.weapons[num]}
                        style="--top-offset:{weaponSprites[num][1]}%; --right-offset:{weaponSprites[num][2]}%;"
                    >
                        <Picture name={weaponSprites[num][0]} />
                    </span>
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
        top: var(--top-offset);
        right: var(--right-offset);
        transform: rotate(calc(var(--rotation))) scale(.7);
        pointer-events: none;
    }
</style>