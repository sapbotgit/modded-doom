<script lang="ts">
    export let flags: number;
    export let info: [number, string][];

    function toggle(flag: number) {
        flags ^= flag;
    }
</script>

<div class="flag-stack text-sm pe-2">
    <span>Flags {flags}</span>
    {#each info as [flag, description]}
        <label class="label p-0 cursor-pointer">
            <span class="label-text">{description}</span>
            <input class="checkbox" type="checkbox" checked={Boolean(flags & flag)} on:change={() => toggle(flag)} />
        </label>
    {/each}
</div>

<style>
.flag-stack {
    display: flex;
    flex-direction: column;
}

.flag-stack label {
    padding-left: 1em;
}
</style>