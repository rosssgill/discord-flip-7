<script lang="ts">
  import { flip } from "svelte/animate";
  import type { Player } from "../../game/engine";
  import { roundScore } from "../../game/scoring";
  import { drawFromDeck, toDiscard } from "../transitions";
  import Avatar from "./Avatar.svelte";
  import Card from "./Card.svelte";

  let {
    player,
    isYou,
    isCurrent,
    online,
    drawn,
    streak,
  }: {
    player: Player;
    isYou: boolean;
    isCurrent: boolean;
    online: boolean;
    drawn: number[];
    streak: number;
  } = $props();

  const SNOWFLAKES = Array.from({ length: 12 }, (_, i) => ({
    angle: i * 30 + (i % 3) * 9,
    distance: 70 + (i % 4) * 22,
  }));

  const cards = $derived([
    ...player.numbers,
    ...player.modifiers,
    ...(player.secondChance ? [player.secondChance] : []),
  ]);
  const points = $derived(
    player.status === "busted"
      ? 0
      : roundScore(player.numbers, player.modifiers, player.draw7),
  );
  const statusLabel = $derived(
    player.draw7
      ? "Draw 7!"
      : { active: "", stayed: "Stayed", frozen: "Frozen", busted: "Bust" }[
          player.status
        ],
  );
</script>

<section
  class="player {player.status}"
  class:current={isCurrent}
  class:you={isYou}
>
  <div class="who" class:offline={!online}>
    <Avatar name={player.name} src={player.avatar} {streak} offline={!online} />
    <span class="name">{isYou ? "You" : player.name}</span>
    {#if statusLabel}<span class="status">{statusLabel}</span>{/if}
  </div>

  <div class="cards">
    {#each cards as card (card.id)}
      <div
        class="slot"
        animate:flip={{ duration: 250 }}
        in:drawFromDeck|global={{
          order: drawn.indexOf(card.id),
          count: drawn.length,
        }}
        out:toDiscard
      >
        <Card {card} />
      </div>
    {/each}
  </div>

  <div class="score">
    <span class="points">+{player.lastRoundScore ?? points}</span>
    <span class="total">{player.total}</span>
  </div>

  {#if player.status === "frozen"}
    <div class="ice" aria-hidden="true">
      {#each SNOWFLAKES as flake, i (i)}
        <span
          class="flake"
          style:--angle="{flake.angle}deg"
          style:--distance="{flake.distance}px">❄</span
        >
      {/each}
    </div>
  {/if}
</section>

<style>
  .player {
    position: relative;
    display: grid;
    grid-template-columns: 4.5rem 1fr auto;
    align-items: center;
    gap: 0.75rem;
    background: var(--panel);
    border: 2px solid transparent;
    border-radius: 0.75rem;
    padding: 0.6rem 0.75rem;
  }
  .current {
    border-color: var(--accent);
  }
  /* Busting dims only the cards; the avatar is reserved for connection state. */
  .busted .cards {
    opacity: 0.45;
  }
  .busted .status {
    color: var(--danger);
  }
  .who {
    display: grid;
    justify-items: center;
    gap: 0.2rem;
    min-width: 0;
  }
  .name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8rem;
    font-weight: 700;
  }
  .offline .name {
    font-style: italic;
    opacity: 0.6;
  }
  .status {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  .frozen .status {
    color: var(--ice);
  }
  .score {
    display: grid;
    justify-items: end;
  }
  .points {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .total {
    font-weight: 800;
    font-size: 1.2rem;
  }
  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    min-height: 4.2rem;
    perspective: 800px;
  }
  .slot {
    position: relative;
    z-index: 1;
    transform-style: preserve-3d;
  }
  .frozen .cards {
    filter: saturate(0.4) brightness(1.08) drop-shadow(0 0 6px var(--ice));
    transition: filter 0.6s;
  }

  /* Frost spreads out from the centre of the panel, and stays while the player is frozen. */
  .ice {
    position: absolute;
    inset: -2px;
    z-index: 2;
    border-radius: inherit;
    border: 2px solid var(--ice);
    background:
      radial-gradient(
        circle at 15% 20%,
        rgb(255 255 255 / 0.35) 0 2px,
        transparent 3px
      ),
      radial-gradient(
        circle at 70% 75%,
        rgb(255 255 255 / 0.3) 0 2px,
        transparent 3px
      ),
      linear-gradient(
        135deg,
        rgb(190 230 255 / 0.32),
        rgb(120 185 255 / 0.12) 60%,
        rgb(220 245 255 / 0.3)
      );
    box-shadow:
      inset 0 0 28px rgb(200 235 255 / 0.65),
      0 0 14px rgb(160 215 255 / 0.5);
    pointer-events: none;
    animation: frost 0.7s ease-out both;
  }
  .flake {
    position: absolute;
    top: 50%;
    left: 50%;
    color: white;
    font-size: 1.5rem;
    text-shadow: 0 0 6px var(--ice);
    animation: burst 1.1s ease-out both;
  }

  @keyframes frost {
    from {
      clip-path: circle(0% at 50% 50%);
      filter: brightness(2);
    }
    to {
      clip-path: circle(150% at 50% 50%);
      filter: brightness(1);
    }
  }
  @keyframes burst {
    from {
      transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0)
        scale(0.4);
      opacity: 1;
    }
    to {
      transform: translate(-50%, -50%) rotate(var(--angle))
        translateX(var(--distance)) rotate(180deg) scale(1);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ice,
    .flake {
      animation: none;
    }
    .flake {
      display: none;
    }
  }
</style>
