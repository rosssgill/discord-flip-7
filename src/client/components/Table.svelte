<script lang="ts">
  import type { GameView } from "../../game/view";
  import type { ClientMessage, User } from "../../shared/protocol";
  import PlayerArea from "./PlayerArea.svelte";

  let {
    game,
    you,
    connected,
    send,
  }: { game: GameView; you: User; connected: string[]; send: (m: ClientMessage) => void } = $props();

  const name = (id: string) => game.players.find((p) => p.id === id)?.name ?? "?";
  const seated = $derived(game.players.some((p) => p.id === you.id));
  const myTurn = $derived(game.phase === "playing" && !game.pending && game.current === you.id);
  const myChoice = $derived(game.pending?.chooser === you.id ? game.pending : null);
  const prompts = { freeze: "Freeze who?", flipThree: "Who flips three?", giveSecondChance: "Give Second Chance to?" };
</script>

<div class="table">
  <header class="bar">
    <span>Round {game.round}</span>
    <span class="muted">Deck {game.deckCount} · Discard {game.discardCount}</span>
  </header>

  <div class="players">
    {#each game.players as player (player.id)}
      <PlayerArea
        {player}
        isYou={player.id === you.id}
        isCurrent={player.id === game.waitingOn}
        online={connected.includes(player.id)}
      />
    {/each}
  </div>

  <footer class="controls">
    {#if game.phase === "gameOver"}
      <strong>{game.winners.map(name).join(" & ")} wins!</strong>
      {#if seated}<button class="primary" onclick={() => send({ type: "newGame" })}>New game</button>{/if}
    {:else if game.phase === "roundOver"}
      <strong>Round {game.round} over</strong>
      {#if seated}<button class="primary" onclick={() => send({ type: "nextRound" })}>Next round</button>{/if}
    {:else if myChoice}
      <strong>{prompts[myChoice.kind]}</strong>
      {#each myChoice.options as option (option)}
        <button onclick={() => send({ type: "choose", target: option })}>
          {option === you.id ? "Me" : name(option)}
        </button>
      {/each}
    {:else if myTurn}
      <button class="primary" onclick={() => send({ type: "hit" })}>Hit</button>
      <button onclick={() => send({ type: "stay" })}>Stay</button>
    {:else if game.waitingOn}
      <span class="muted">Waiting for {name(game.waitingOn)}…</span>
    {/if}
  </footer>

  <ol class="log">
    {#each game.log.slice(-6).reverse() as line}
      <li>{line}</li>
    {/each}
  </ol>
</div>

<style>
  .table {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 48rem;
    margin: 0 auto;
  }
  .bar {
    display: flex;
    justify-content: space-between;
    font-weight: 700;
  }
  .players {
    display: grid;
    gap: 0.6rem;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    min-height: 2.75rem;
  }
  .log {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .log li:first-child {
    color: inherit;
  }
</style>
