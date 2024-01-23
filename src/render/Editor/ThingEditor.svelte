<script lang="ts">
    import { thingSpec, type ThingSpec, states, SpriteNames, MapRuntime, mapObjectInfo, MapObjectIndex } from "../../doom";
    import { useAppContext, useDoom } from "../DoomContext";
    import ThingSprite from "./ThingSprite.svelte";
    import { ToDegrees, ToRadians } from "../../doom";
    import FlagList from "./FlagList.svelte";
    import { MapObject } from "../../doom/map-object";
    import NumberChooser from "./NumberChooser.svelte";

    const { editor } = useAppContext();
    const { textures, wad } = useDoom();

    export let map: MapRuntime;
    export let thing: MapObject;

    // https://doomwiki.org/wiki/Thing#Flags
    const flagInfo: [number, string][] = [
        [0x0001, 'On skill 1 and 2 ("I\'m too young to die." and "Hey, not too rough.")'],
        [0x0002, 'On skill 3 ("Hurt me plenty.")'],
        [0x0004, 'On skill 4 and 5 ("Ultra Violence." and "Nightmare!")'],
        [0x0008, 'Ambush (aka the "deaf" flag)'],
        [0x0010, 'Multiplayer-only'],
    ]

    const { direction, sprite, position } = thing;
    const frames = wad.spriteFrames($sprite.name);
    const frame = frames[$sprite.frame][8] ?? frames[$sprite.frame][0];
    const texture = textures.get(frame.name, 'sprite');

    let showSelector = false;
    let selectorFilter = '';
    function toggleSelector() {
        showSelector = !showSelector;
    }

    type ParialThingSpec = Omit<ThingSpec, 'mo'>
    function changeType(th: ParialThingSpec) {
        map.destroy(thing);
        const pos = thing.position.val;
        thing = map.spawn(mapObjectInfo.findIndex(e => e.doomednum === th.type), pos.x, pos.y);
        setDirection($direction * ToDegrees)();
        $editor.selected = thing;

        selectorFilter = '';
        showSelector = false;
    }

    $: directionButton = Math.floor($direction * ToDegrees) / 45;
    function setDirection(degrees: number) {
        return () => {
            thing.direction.set(degrees * ToRadians);
        };
    }

    function editorThing(idx: any) {
        const value = thingSpec(idx);
        const state = states[value.mo.spawnstate];
        const sprite = SpriteNames[state.sprite];
        const frames = (sprite && wad.spriteFrames(sprite)) ?? [];
        const text = `${value.description} (${value.type})`;
        if (frames.length === 0) {
            // if we don't have sprite frames (like for a doom2 enemy but we're using a doom1 wad)
            // then return null and filter later
            return null;
        }
        return { value, state, frames, text };
    }

    function changeThing(ev) {
        const mobj = map.objs.find(e => e.id === ev.detail);
        if (mobj) {
            $editor.selected = mobj;
        }
    }

    let subsectors = [];
    $: if ($position) {
        subsectors = []
        thing.subsectors(s => subsectors.push(s));
    }

    $: types = Object.keys(MapObjectIndex)
        .filter(e => !isNaN(Number(e)))
        .map(editorThing)
        .filter(e => e?.value.mo.doomednum >= 0);
</script>

<h3>Thing <NumberChooser num={thing.id} on:select={changeThing} /></h3>
<div>
    <button class="btn" on:click={toggleSelector}>{thing.description}</button>
    {#if showSelector}
        <div class="selector">
            <!-- svelte-ignore a11y-autofocus -->
            <input autofocus type="text" placeholder="Search..." autocomplete="off" id="searchInput" bind:value={selectorFilter} on:input>
            {#each types as t}
                {#if !selectorFilter.length || t.text.toLowerCase().includes(selectorFilter)}
                    <button class="btn" on:click={() => changeType(t.value)}>
                        <ThingSprite frames={t.frames} state={t.state} text={t.text} />
                    </button>
                {/if}
            {/each}
        </div>
    {/if}
</div>
<div>
    <!--
    Hmm... during some refactoring, we removed this data from MObj. Should we bring it back?
    <FlagList info={flagInfo} bind:flags={thing.source.flags} />
    -->
</div>
<div>
    <div>Position: {[$position.x.toFixed(2), $position.y.toFixed(2), $position.z.toFixed(2)]}</div>
    <div>Subsectors: [{subsectors.map(e => e.num)}]</div>
    <div>Sectors: [{[...new Set(subsectors.map(e=>e.sector.num))]}]</div>
</div>
<!-- position is edited in Thing.svelte -->
<div class="direction">
    <button class="btn" class:selected={directionButton === 7} on:click={setDirection(315)}>NW</button>
    <button class="btn" class:selected={directionButton === 6} on:click={setDirection(270)}>North</button>
    <button class="btn" class:selected={directionButton === 5} on:click={setDirection(225)}>NE</button>
    <button class="btn" class:selected={directionButton === 0} on:click={setDirection(0)}>West</button>
    <span>{Math.floor($direction * ToDegrees)} degrees</span>
    <button class="btn" class:selected={directionButton === 4} on:click={setDirection(180)}>East</button>
    <button class="btn" class:selected={directionButton === 1} on:click={setDirection(45)}>SW</button>
    <button class="btn" class:selected={directionButton === 2} on:click={setDirection(90)}>South</button>
    <button class="btn" class:selected={directionButton === 3} on:click={setDirection(135)}>SE</button>
</div>
<div>
    <span>Sprite Info</span>
    <div>name: {frame.name}</div>
    <div>[width, height]: [{texture.userData.width}, {texture.userData.height}]</div>
    <div>[xOffset, yOffset]: [{texture.userData.xOffset}, {texture.userData.yOffset}]</div>
    <div>fullbright: {$sprite.fullbright}</div>
</div>

<style>
    div {
        position: relative;
    }

    input[type="text"] {
        padding: .25em .5em;
        font-size: 1.2em;
    }

    .direction {
        align-self: center;
        padding: 2em 0em;
        width: 12em;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
    }
    .direction button.selected {
        background: green;
    }
    .direction span {
        width: 2em;
        text-align: center;
        align-self: center;
    }

    .selector {
        z-index: 1;
        overflow-y: scroll;
        max-height: 30em;
        position: absolute;
        display: flex;
        flex-direction: column;
    }
</style>