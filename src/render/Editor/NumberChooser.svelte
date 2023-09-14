<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export let num: number;

    const dispatch = createEventDispatcher();
    function change(ev) {
        const newNum = parseInt(ev.target.innerText);
        if (isFinite(newNum)) {
            dispatch('select', newNum)
        }
    }
</script>

<span contenteditable on:blur={change}>{num}</span>

<style>
    span::before {
        content: '(';
    }
    span::after {
        content: ')';
    }
</style>