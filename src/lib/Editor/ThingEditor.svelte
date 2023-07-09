<script lang="ts">
    import { MapObject, type DoomMap } from "../../doomwad";
    import { things, thingSpec, type ThingSpec } from '../../doom-things';
    import { useDoom } from "../useDoom";
    import ThingSprite from "./ThingSprite.svelte";
    import { ToDegrees, ToRadians } from "../Math";

    const { editor, textures } = useDoom();

    export let map: DoomMap;
    export let thing: MapObject;

    const { direction, sprite, spec } = thing;
    const frames = map.wad.spriteFrames(spec.sprite);
    const frame = frames[$sprite.frame][8] ?? frames[$sprite.frame][0];
    const texture = textures.get(frame.name, 'sprite');

    let showSelector = false;
    let selectorFilter = '';
    function toggleSelector() {
        showSelector = !showSelector;
    }

    type ParialThingSpec = Omit<ThingSpec, 'mo'>
    function changeType(th: ParialThingSpec) {
        const index = map.renderThings.indexOf(thing);
        thing = new MapObject(map, { ...thing.source, type: th.type });
        map.renderThings[index] = thing;
        $editor.selected = thing;
        $editor.updateThings(); // kind of a reactivity hack. I'd like to to better...

        selectorFilter = '';
        showSelector = false;
    }

    $: directionButton = Math.floor($direction * ToDegrees) / 45;
    function setDirection(degrees: number) {
        return () => {
            $direction = degrees * ToRadians;
            thing.source.angle = degrees;
        };
    }

    $: types = things.map(e => ({ value: e, text: `${e.description} (${e.type})` }))
        // doom2 enemies won't be available in doom1 wads
        .filter(e => map.wad.spriteFrames(thingSpec(e.value.type).sprite).length > 0)
</script>

<h3>Thing</h3>
<div>
    <button on:click={toggleSelector}>{thing.spec.description}</button>
    {#if showSelector}
        <div class="selector">
            <input autofocus type="text" placeholder="Search..." autocomplete="off" id="searchInput" bind:value={selectorFilter} on:input>
            {#each types as t}
                {#if !selectorFilter.length || t.text.toLowerCase().includes(selectorFilter)}
                    <button on:click={() => changeType(t.value)}>
                        <ThingSprite {map} spec={thingSpec(t.value.type)} text={t.text} />
                    </button>
                {/if}
            {/each}
        </div>
    {/if}
</div>
<div class="flag-stack">
    <span>Flags</span>
    <!--
        https://doomwiki.org/wiki/Thing#Flags
        0 	0x0001 	Thing is on skill levels 1 & 2
        1 	0x0002 	Thing is on skill level 3
        2 	0x0004 	Thing is on skill levels 4 & 5
        3 	0x0008 	Thing is waiting in ambush. Commonly known as "deaf" flag.
                     In fact, it does not render monsters deaf per se.
        4 	0x0010 	Thing is not in single player
    -->
    <label>
        <input type="checkbox" checked={Boolean(thing.source.flags & 0x0001)} />
        On skill 1 and 2 ("I'm too young to die." and "Hey, not too rough.")
    </label>
    <label>
        <input type="checkbox" checked={Boolean(thing.source.flags & 0x0002)} />
        On skill 3 ("Hurt me plenty.")
    </label>
    <label>
        <input type="checkbox" checked={Boolean(thing.source.flags & 0x0004)} />
        On skill 4 and 5 ("Ultra Violence." and "Nightmare!")
    </label>
    <label>
        <input type="checkbox" checked={Boolean(thing.source.flags & 0x0008)} />
        Ambush (aka the "deaf" flag)
    </label>
    <label>
        <input type="checkbox" checked={Boolean(thing.source.flags & 0x0010)} />
        Multiplayer-only
    </label>
</div>
<!-- position is edited in Thing.svelte -->
<div class="direction">
    <button class:selected={directionButton === 7} on:click={setDirection(315)}>NW</button>
    <button class:selected={directionButton === 6} on:click={setDirection(270)}>North</button>
    <button class:selected={directionButton === 5} on:click={setDirection(225)}>NE</button>
    <button class:selected={directionButton === 0} on:click={setDirection(0)}>East</button>
    <span>{Math.floor($direction * ToDegrees)} degrees</span>
    <button class:selected={directionButton === 4} on:click={setDirection(180)}>West</button>
    <button class:selected={directionButton === 1} on:click={setDirection(45)}>SW</button>
    <button class:selected={directionButton === 2} on:click={setDirection(90)}>South</button>
    <button class:selected={directionButton === 3} on:click={setDirection(135)}>SE</button>
</div>
<div>
    <span>Sprite Info</span>
    <div>name: {frame.name}</div>
    <div>width: {texture.userData.width}</div>
    <div>height: {texture.userData.height}</div>
    <div>xOffset: {texture.userData.xOffset}</div>
    <div>yOffset: {texture.userData.yOffset}</div>
</div>

<style>
    div {
        position: relative;
    }

    .flag-stack {
        display: flex;
        flex-direction: column;
    }

    .flag-stack label {
        padding-left: 1em;
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