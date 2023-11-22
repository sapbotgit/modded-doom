<script lang="ts">
    import { fly } from "svelte/transition";
    import { tick } from "svelte";
    import type { PlayerMapObject } from "../../doom";
    import Picture from "../Components/Picture.svelte";

    export let player: PlayerMapObject;
    const hudMessage = player.hudMessage;

    // A neat little hack (IMO). We don't need a list of messages but instead put each message into the DOM and let the
    // animation api remove them when they expire. We need separate two DOM nodes to separate in/out transition though
    // and we use a scroll bar in the messageView to control how many messages are displayed at a time.
    // There is still an annoying jiggle when elements are removed but I'm not yet sure how to remove that but I'll keep thinking...
    let messageView: HTMLDivElement;
    let message = '';
    // without mesage number, we would only see the first of duplicate messages
    let messageNumber = 0;
    $: handleHudMessage($hudMessage);
    async function handleHudMessage(text: string) {
        message = text.toUpperCase();
        messageNumber += 1;
        await tick();
        $hudMessage = '';
        messageView.scroll({ top: messageView.scrollHeight, behavior: 'smooth' });
    }
</script>

<div bind:this={messageView} class="messages">
    {#key messageNumber}
        <div out:fly|local={{ y: -8, delay: 4000 }}>
            <div in:fly={{ y: -8 }} class="message">
                {#each message as char, i}
                    {#if char === ' '}
                        <span class="space" />
                    {:else}
                        <Picture name={`STCFN${message.charCodeAt(i).toString().padStart(3, '0')}`} />
                    {/if}
                {/each}
            </div>
        </div>
    {/key}
</div>

<style>
    .messages {
        position: absolute;
        top: 0;
        left: 0;
        transform: scale(2);
        transform-origin: top left;
        display: flex;
        flex-direction: column;
        gap: 1px;
        /* Only show 3 messages: 7px + 3x1px gap (+1px top) */
        max-height: calc(3 * (7px + 1px) + 1px);
        overflow-y: scroll;
        scrollbar-width: none;
    }
    .messages::-webkit-scrollbar {
        display: none;
    }

    .message {
        position: relative;
        display: flex;
        align-items: end;
    }
    .space {
        width: 5px;
        display: inline-block;
    }
</style>