<script lang="ts">
  import { flip } from "svelte/animate";
  import { scale } from "svelte/transition";
  import type { Player } from "../../game/engine";
  import { roundScore } from "../../game/scoring";
  import Card from "./Card.svelte";

  let { player, isYou, isCurrent, online }: { player: Player; isYou: boolean; isCurrent: boolean; online: boolean } =
    $props();

  const cards = $derived([...player.numbers, ...player.modifiers, ...(player.secondChance ? [player.secondChance] : [])]);
  const points = $derived(
    player.status === "busted" ? 0 : roundScore(player.numbers, player.modifiers, player.flip7),
  );
</script>

<section class="player {player.status}" class:current={isCurrent} class:you={isYou}>
  <header>
    <span class="name" class:offline={!online}>{player.name}{isYou ? " (you)" : ""}</span>
    <span class="status">{player.flip7 ? "Flip 7!" : player.status}</span>
    <span class="points">+{player.lastRoundScore ?? points}</span>
    <span class="total">{player.total}</span>
  </header>
  <div class="cards">
    {#each cards as card (card.id)}
      <div animate:flip={{ duration: 250 }} in:scale={{ duration: 250, start: 0.6 }}>
        <Card {card} />
      </div>
    {/each}
  </div>
</section>

<style>
  .player {
    background: var(--panel);
    border: 2px solid transparent;
    border-radius: 0.75rem;
    padding: 0.6rem 0.75rem;
  }
  .current {
    border-color: var(--accent);
  }
  .busted {
    opacity: 0.55;
  }
  header {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    margin-bottom: 0.5rem;
  }
  .name {
    font-weight: 700;
  }
  .offline {
    opacity: 0.5;
    font-style: italic;
  }
  .status {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--muted);
  }
  .points {
    margin-left: auto;
    color: var(--muted);
  }
  .total {
    font-weight: 800;
    min-width: 2.5rem;
    text-align: right;
  }
  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    min-height: 4.2rem;
  }
</style>
