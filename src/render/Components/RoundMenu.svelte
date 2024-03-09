<script lang="ts">
    import { fly } from "svelte/transition";
    import { ToRadians } from "../../doom";

    // based on https://css-tricks.com/building-a-circular-navigation-with-css-clip-paths/
    export let gap = 1;
    export let slices = 9;
    export let spanAngle = 200;
    export let innerRadius = 0.2;
    const duration = 50;

    $: span = spanAngle - gap * (slices + 1);
    $: halfGap = gap * .5;
    $: sliceAngle = (span + halfGap) / slices;
    $: baseAngle = (span - 180 + slices * halfGap) * .5;
    $: cx = .5 + 0.5 * Math.cos(-span * ToRadians / slices);
    $: cy = .5 + 0.5 * Math.sin(-span * ToRadians / slices);
    $: dx = .5 + innerRadius * Math.cos(-span * ToRadians / slices);
    $: dy = .5 + innerRadius * Math.sin(-span * ToRadians / slices);
</script>

<ul class="relative menu left-0">
    {#each { length: slices } as _, i}
        {@const rotation = (i * (sliceAngle + gap)) - baseAngle}
        <li
            in:fly|global={{ y: '100%', duration, delay: i * 20 }}
            out:fly|global={{ y: '100%', duration, delay: (slices - i) * 20 }}
            style="--rotate:{-rotation}deg;"
        >
            <slot num={i} {rotation} angle={sliceAngle * -.5} />
        </li>
    {/each}
</ul>

<svg>
    <defs>
        <clipPath clipPathUnits="objectBoundingBox" id="sector">
            <!-- <path d="M0.5,0.5 l0.5,0 A0.5,0.5 0 0,0 {cx},{cy} z" /> -->
            <path d="M{.5 + innerRadius},0.5 A{innerRadius},{innerRadius} 0,0,0 {dx},{dy} L{cx},{cy} A0.5,0.5 0,0,1 1,0.5 z" />
        </clipPath>
    </defs>
</svg>

<style>
    .menu {
        padding: 0;
        padding-top: 100%;
        width: 100%;
        height: 0;
        list-style: none;
        clip-path: circle(50%);
        transform: translateY(30%);
    }

    li {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        clip-path: url(#sector);
        transform: rotate(var(--rotate));
    }
</style>
