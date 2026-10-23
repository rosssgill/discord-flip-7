<script lang="ts">
  import type { Snippet } from "svelte";
  import CardBack from "./CardBack.svelte";

  let {
    deckCount,
    discardCount,
    children,
  }: { deckCount: number; discardCount: number; children?: Snippet } = $props();

  // A few offset backs suggest a stack without rendering every card.
  const layers = (count: number) => Math.min(3, count);
</script>

<div class="piles">
  <figure>
    <div class="stack" data-pile="deck">
      {#each { length: layers(deckCount) }, i (i)}
        <div class="layer" style:--i={i}><CardBack /></div>
      {/each}
      {#if deckCount === 0}<div class="empty"></div>{/if}
    </div>
    <figcaption>Deck {deckCount}</figcaption>
  </figure>
  <div class="between">{@render children?.()}</div>
  <figure>
    <div class="stack discard" data-pile="discard">
      {#each { length: layers(discardCount) }, i (i)}
        <div class="layer" style:--i={i}><CardBack /></div>
      {/each}
      {#if discardCount === 0}<div class="empty"></div>{/if}
    </div>
    <figcaption>Discard {discardCount}</figcaption>
  </figure>
</div>

<style>
  .piles {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
  }
  .between {
    min-width: 3rem;
  }
  figure {
    margin: 0;
    display: grid;
    justify-items: center;
    gap: 0.35rem;
  }
  figcaption {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .stack {
    position: relative;
    width: 3rem;
    height: 4.2rem;
  }
  .layer {
    position: absolute;
    top: calc(var(--i) * -2px);
    left: calc(var(--i) * 2px);
  }
  .discard {
    opacity: 0.6;
  }
  .empty {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border: 2px dashed var(--muted);
    border-radius: 0.5rem;
  }
</style>
