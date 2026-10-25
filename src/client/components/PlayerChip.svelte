<script lang="ts">
  import type { Player } from "../../game/engine";
  import { roundScore } from "../../game/scoring";
  import Avatar from "./Avatar.svelte";

  let {
    player,
    isCurrent,
    isPeeked,
    online,
    streak,
    onpeek,
  }: {
    player: Player;
    isCurrent: boolean;
    isPeeked: boolean;
    online: boolean;
    streak: number;
    onpeek: () => void;
  } = $props();

  const detail = $derived.by(() => {
    if (player.draw7) return "Draw 7!";
    if (player.status === "busted") return "Bust";
    if (player.status === "frozen") return "❄ Frozen";
    const points = `+${player.lastRoundScore ?? roundScore(player.numbers, player.modifiers, false)}`;
    return player.status === "stayed" ? `${points} ✓` : points;
  });
</script>

<button
  class="chip {player.status}"
  class:current={isCurrent}
  class:peeked={isPeeked}
  onclick={onpeek}
  aria-pressed={isPeeked}
  aria-label="Show {player.name}'s cards"
>
  <Avatar
    name={player.name}
    src={player.avatar}
    size={28}
    {streak}
    offline={!online}
  />
  <span class="name">{player.name}</span>
  <span class="total">{player.total}</span>
  <span class="detail">{detail}</span>
</button>

<style>
  .chip {
    display: grid;
    justify-items: center;
    gap: 0.05rem;
    width: 3.2rem;
    padding: 0.3rem 0.15rem 0.25rem;
    border: 2px solid transparent;
    border-radius: 0.6rem;
    background: var(--panel);
    font-weight: 400;
  }
  .current {
    border-color: var(--accent);
  }
  .peeked {
    background: color-mix(in srgb, var(--panel), white 12%);
  }
  .frozen {
    border-color: var(--ice);
    box-shadow: inset 0 0 10px rgb(200 235 255 / 0.5);
  }
  .name {
    max-width: 100%;
    margin-top: 0.15rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.65rem;
  }
  .total {
    font-weight: 800;
    font-size: 0.85rem;
    line-height: 1.1;
  }
  .detail {
    font-size: 0.6rem;
    color: var(--muted);
    white-space: nowrap;
  }
  .busted .detail {
    color: var(--danger);
  }
  .frozen .detail {
    color: var(--ice);
  }
</style>
