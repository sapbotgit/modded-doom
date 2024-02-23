<script lang="ts">
    import type { EventHandler } from "svelte/elements";
    import type { Game, PlayerMapObject } from "../../doom";
    import RoundMenu from "./RoundMenu.svelte";
    import type { Vector3 } from "three";
    import type { Action, ActionReturn } from "svelte/action";
    import Picture from "./Picture.svelte";
    import type { Size } from "@threlte/core";
    import { useAppContext } from "../DoomContext";

    export let game: Game;
    export let viewSize: Size;
    export let player: PlayerMapObject = null;
    $: tick = game.time.tick;

    const { settings } = useAppContext();
    const { touchDeadZone, tapTriggerTime, touchLookSpeed, analogMovement, touchTargetHzPadding, touchTargetVPadding, touchTargetSize } = settings;
    const nowTime = () => new Date().getTime() * 0.001;

    let useButton = false;
    let useLock = false;
    let attackButton = false;
    let attackLock = false;
    $: if ($tick) {
        game.input.attack = false;
        game.input.use = false;
        if (attackButton || attackLock) {
            game.input.attack = true;
            attackButton = false;
        }
        if (useButton || useLock) {
            game.input.use = true;
            useButton = false;
        }
    }

    function clipMove(val: number) {
        if (Math.abs(val) < $touchDeadZone) {
            return 0;
        }
        const scaled = Math.sign(val) * (Math.abs(val) - $touchDeadZone) / (1 - $touchDeadZone);
        return Math.max(-1, Math.min(1, scaled));
    }

    function analogClip(val: number) {
        if (Math.abs(val) < $touchDeadZone) {
            return 0;
        }
        return Math.max(-1, Math.min(1, Math.sign(val)));
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
        'on:touch-point': EventHandler<CustomEvent<Vector3>>;
    }

    // TODO: combine similar parts of move controls and look controls
    // TODO: alternatively, maybe we can make this simpler by not using an action and instead having on:touchstart, on:touchmove, etc. on the DOM node?
    const touchMoveControls: Action<HTMLElement, Params, Attributes> = (node, params): ActionReturn<Params, Attributes> => {
        let { input } = params;

        let touchTime = 0;
        let touchNum: number;
        let bounds: DOMRect;
        let box = { midX: 0, midY: 0, halfWidth: 0, halfHeight: 0 };
        resize();

        node.addEventListener('touchstart', touchstart);
        node.addEventListener('touchmove', touchmove);
        node.addEventListener('touchend', touchend);
        node.addEventListener('touchcancel', touchend);
        const update = (params: Params) => {
            input = params.input;
            resize();
        };
        const destroy = () => {
            node.removeEventListener('touchstart', touchstart);
            node.removeEventListener('touchmove', touchmove);
            node.removeEventListener('touchend', touchend);
            node.removeEventListener('touchcancel', touchend);
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
            if ($analogMovement) {
                input.move.x = analogClip((t.clientX - box.midX) / box.halfWidth);
                input.move.y = analogClip(-(t.clientY - box.midY) / box.halfHeight);
            } else {
                input.move.x = clipMove((t.clientX - box.midX) / box.halfWidth);
                input.move.y = clipMove(-(t.clientY - box.midY) / box.halfHeight);
            }
            node.dispatchEvent(new CustomEvent<{ x: number, y: number }>('touch-point', { detail: input.move }));
        }

        function touchstart(ev: TouchEvent) {
            const now = nowTime();
            const elapsed = (now - touchTime);
            // Is this even useful? It's symmetric with attack but I can't imagine someone doing this
            if (elapsed < 2 * $tapTriggerTime) {
                useLock = true;
            }
            touchTime = now;

            touchNum = ev.changedTouches[0].identifier;
            updateTouch(findTouch(ev.touches, touchNum));
        }

        function touchmove(ev: TouchEvent) {
            updateTouch(findTouch(ev.touches, touchNum));
            ev.preventDefault();
        }

        function touchend(ev: TouchEvent) {
            if (nowTime() - touchTime < $tapTriggerTime) {
                useButton = true;
            }
            useLock = false;

            input.move.set(0, 0, 0);
            node.dispatchEvent(new CustomEvent<{ x: number, y: number }>('touch-point', { detail: input.move }));
        }
    };

    const touchLookControls: Action<HTMLElement, Params, Attributes> = (node, params): ActionReturn<Params, Attributes> => {
        let { input } = params;

        let touchTime = 0;
        let touchNum: number;
        let touchActive = false;
        let bounds: DOMRect;
        let box = { midX: 0, midY: 0, halfWidth: 0, halfHeight: 0 };
        let aim = { x: 0, y: 0 };
        resize();

        node.addEventListener('touchstart', touchstart);
        node.addEventListener('touchmove', touchmove);
        node.addEventListener('touchend', touchend);
        node.addEventListener('touchcancel', touchend);
        const update = (params: Params) => {
            input = params.input;
            resize();
        };
        const destroy = () => {
            node.removeEventListener('touchstart', touchstart);
            node.removeEventListener('touchmove', touchmove);
            node.removeEventListener('touchend', touchend);
            node.removeEventListener('touchcancel', touchend);
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
            const now = nowTime();
            const elapsed = (now - touchTime);
            if (elapsed < 2 * $tapTriggerTime) {
                attackLock = true;
            }
            touchTime = now;

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
            if (nowTime() - touchTime < $tapTriggerTime) {
                attackButton = true;
            }
            attackLock = false;

            touchActive = false;
            aim.x = aim.y = 0;
            node.dispatchEvent(new CustomEvent('touch-point', { detail: aim }));
        }

        function updateTouch(t: Touch) {
            aim.x = clipMove((t.clientX - box.midX) / box.halfWidth);
            aim.y = clipMove((t.clientY - box.midY) / box.halfHeight);
            node.dispatchEvent(new CustomEvent('touch-point', { detail: aim }));
        }

        function onTick() {
            input.aim.x = $touchLookSpeed * aim.x;
            input.aim.y = $touchLookSpeed * aim.y;
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
    if (!game.wad.spriteTextureData('SHT2A0')) {
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
    let movePoint = { x: 50, y: 50 };
    let lookPoint = { x: 50, y: 50 };
    const touchPoint = (point: Point, ev: CustomEvent<Vector3>) => {
        point.x = (ev.detail.x + 1) * 50;
        point.y = (ev.detail.y + 1) * 50;
        return point;
    };
</script>

<div
    class="absolute w-full flex justify-between opacity-30"
    style="padding-inline:{$touchTargetHzPadding}em; bottom:{$touchTargetVPadding}em;"
>
    <div
        use:touchMoveControls={touchParams}
        on:touch-point={ev => movePoint = touchPoint(movePoint, ev)}
        style="--px:{movePoint.x}%; --py:{100 - movePoint.y}%; --size:{$touchTargetSize}em;"
        class="touchGradient border-2 border-primary-content rounded-full"
        class:extra-active={useButton || useLock}
        class:analog-move={$analogMovement}
    />
    <div
        class="touchGradient rounded-full relative"
        style="--px:50%; --py:50%; --size:{$touchTargetSize * .8}em; top:{$touchTargetVPadding * .5}em;"
        on:touchstart|preventDefault={() => showWeaponMenu = true}
        on:touchmove|preventDefault={weaponWheelTouchMove}
        on:touchend={weaponWheelTouchEnd}
        on:touchcancel={() => showWeaponMenu = false}
    />
    <div
        use:touchLookControls={touchParams}
        on:touch-point={ev => lookPoint = touchPoint(lookPoint, ev)}
        style="--px:{lookPoint.x}%; --py:{lookPoint.y}%; --size:{$touchTargetSize}em;"
        class="touchGradient border-2 border-primary-content rounded-full"
        class:extra-active={attackButton || attackLock}
    />
</div>

{#if showWeaponMenu && player}
    <div class="absolute flex justify-center items-center w-full bottom-8">
        <div class="absolute w-[30%] translate-y-[-75%] top-0">
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
    /* https://stackoverflow.com/questions/4472891 */
    :root {
        touch-action: pan-x pan-y;
    }

    .touchGradient {
        --grad-bg: transparent;
        --grad-size: 25%;
        background-image: radial-gradient(
            circle at var(--px) var(--py),
            oklch(var(--a)), oklch(var(--a)) var(--grad-size), var(--grad-bg) calc(var(--grad-size) + 5%));
        width: var(--size);
        height: var(--size);
    }

    .analog-move {
        --grad-size: 40%;
        clip-path: polygon(35% 0%,65% 0%,65% 35%,100% 35%,100% 60%,65% 60%,65% 100%,35% 100%,35% 60%,0% 60%,0% 35%,35% 35%);
        background-color: oklch(var(--b1));
        border: none;
        border-radius: 0;
    }

    .extra-active {
        --a: var(--s);
        --grad-bg: oklch(var(--b3));
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