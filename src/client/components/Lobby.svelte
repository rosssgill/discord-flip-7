<script lang="ts">
  import { MIN_PLAYERS } from "../../game/engine";
  import type { GameView } from "../../game/view";
  import type { ClientMessage, User } from "../../shared/protocol";

  let {
    game,
    spectators,
    you,
    send,
  }: { game: GameView; spectators: User[]; you: User; send: (m: ClientMessage) => void } = $props();

  const seated = $derived(game.players.some((p) => p.id === you.id));
</script>

<div class="lobby">
  <h1>Flip 7</h1>
  <p class="muted">Flip cards to get closest to 200 without busting on a duplicate number.</p>

  <h2>Players ({game.players.length})</h2>
  <ul>
    {#each game.players as player (player.id)}
      <li>{player.name}{player.id === you.id ? " (you)" : ""}</li>
    {:else}
      <li class="muted">Nobody yet</li>
    {/each}
  </ul>

  {#if spectators.length}
    <p class="muted">Watching: {spectators.map((s) => s.name).join(", ")}</p>
  {/if}

  <div class="actions">
    {#if seated}
      <button onclick={() => send({ type: "leave" })}>Leave</button>
      <button class="primary" disabled={game.players.length < MIN_PLAYERS} onclick={() => send({ type: "start" })}>
        Start game
      </button>
    {:else}
      <button class="primary" onclick={() => send({ type: "join" })}>Join game</button>
    {/if}
  </div>
</div>

<style>
  .lobby {
    max-width: 28rem;
    margin: 2rem auto;
  }
  ul {
    padding-left: 1.2rem;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }
</style>
