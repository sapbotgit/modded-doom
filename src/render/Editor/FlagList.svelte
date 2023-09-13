<script lang="ts">
    export let flags: number;
    export let info: [number, string][];

    function toggle(flag: number) {
        flags ^= flag;
    }
</script>

<div class="flag-stack">
    <span>Flags {flags}</span>
    {#each info as [flag, description]}
        <label>
            <input type="checkbox" checked={Boolean(flags & flag)} on:change={() => toggle(flag)} />
            {description}
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