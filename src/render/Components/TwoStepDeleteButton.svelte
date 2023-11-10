<script lang="ts">
    import { fly } from "svelte/transition";
    let confirm = false;
</script>

<div>
    {#if confirm}
        <div class="confirm" in:fly|local={{ x: 20 }}>
            Remove: Are you sure?
            <button on:click|stopPropagation>Yes</button>
            <button on:click|stopPropagation={() => confirm = false}>No</button>
        </div>
    {:else}
        <button on:click|stopPropagation={() => confirm = true}><slot/></button>
    {/if}
</div>

<style>
    div {
        display: flex;
        flex-direction: column;
    }
    .confirm {
        top: 0;
        right: 0;
    }
</style>