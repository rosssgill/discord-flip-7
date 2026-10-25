<script lang="ts">
  import type { GameView } from "../../game/view";
  import { roundScore } from "../../game/scoring";
  import type { User } from "../../shared/protocol";

  let { game, you }: { game: GameView; you: User } = $props();

  const name = (id: string) =>
    id === you.id
      ? "You"
      : (game.players.find((p) => p.id === id)?.name ?? "?");
  const me = $derived(game.players.find((p) => p.id === you.id));
  const roundNote = $derived(
    !me
      ? ""
      : me.status === "busted"
        ? "bust"
        : `+${roundScore(me.numbers, me.modifiers, me.draw7)}`,
  );
  const headline = $derived.by(() => {
    if (game.phase === "lobby") return `${game.players.length} in the lobby`;
    if (game.phase === "gameOver")
      return `${game.winners.map(name).join(" & ")} won!`;
    if (game.phase === "roundOver") return `Round ${game.round} over`;
    if (game.waitingOn === you.id) return "Your turn!";
    return game.waitingOn
      ? `${name(game.waitingOn)}'s turn`
      : `Round ${game.round}`;
  });
</script>

<div class="compact" class:alert={game.waitingOn === you.id}>
  <span class="title">Draw 7</span>
  <strong class="headline">{headline}</strong>
  {#if me && game.phase !== "lobby"}
    <span class="muted"
      >{me.total} pts{game.phase === "playing"
        ? ` · this round ${roundNote}`
        : ""}</span
    >
  {/if}
</div>

<style>
  .compact {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.2rem;
    height: 100vh;
    padding: 0 0.9rem;
    box-sizing: border-box;
    overflow: hidden;
    white-space: nowrap;
  }
  .alert {
    box-shadow: inset 0 0 0 3px var(--accent);
  }
  .title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
  .headline {
    font-size: 1.3rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
