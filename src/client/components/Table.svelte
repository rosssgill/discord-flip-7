<script lang="ts">
  import { fade } from "svelte/transition";
  import type { GameView } from "../../game/view";
  import { type ClientMessage, NEXT_ROUND_DELAY_MS, TURN_TIMEOUT_MS, type User } from "../../shared/protocol";
  import type { AudioSettings } from "../sounds";
  import { cardLabel } from "../../game/engine";
  import { drawFromDeck, toDiscard } from "../transitions";
  import Card from "./Card.svelte";
  import AudioMenu from "./AudioMenu.svelte";
  import Piles from "./Piles.svelte";
  import PlayerArea from "./PlayerArea.svelte";
  import PlayerChip from "./PlayerChip.svelte";
  import SpectatorBar from "./SpectatorBar.svelte";
  import TurnTimer from "./TurnTimer.svelte";

  let {
    game,
    you,
    connected,
    send,
    audio = $bindable(),
    spectators,
    timerDeadline,
  }: {
    game: GameView;
    you: User;
    connected: string[];
    send: (m: ClientMessage) => void;
    audio: AudioSettings;
    spectators: User[];
    timerDeadline: number | null;
  } = $props();

  // Leaving mid-game forfeits, so it takes a second tap to confirm.
  const CONFIRM_MS = 4000;
  let confirmingLeave = $state(false);
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;
  const midGame = $derived(game.phase === "playing" || game.phase === "roundOver");
  function leave() {
    if (midGame && !confirmingLeave) {
      confirmingLeave = true;
      confirmTimer = setTimeout(() => (confirmingLeave = false), CONFIRM_MS);
      return;
    }
    clearTimeout(confirmTimer);
    confirmingLeave = false;
    send({ type: "leave" });
  }

  const name = (id: string) => game.players.find((p) => p.id === id)?.name ?? "?";
  const seated = $derived(game.players.some((p) => p.id === you.id));
  const myTurn = $derived(game.phase === "playing" && !game.pending && game.current === you.id);
  const myChoice = $derived(game.pending?.chooser === you.id ? game.pending : null);
  const prompts = { freeze: "Freeze who?", flipThree: "Who flips three?", giveSecondChance: "Give Second Chance to?" };

  // Phones and big tables get a spotlight on whoever is acting plus a strip of chips,
  // so up to 18 players fit without scrolling.
  const NARROW_MAX_WIDTH = 640;
  const MAX_FULL_PANELS = 8;
  let innerWidth = $state(window.innerWidth);
  const narrow = $derived(innerWidth < NARROW_MAX_WIDTH);
  const spotlightLayout = $derived(narrow || game.players.length > MAX_FULL_PANELS);

  // A peek lasts until the game moves on to someone else.
  let peek = $state<{ player: string; during: string | null } | null>(null);
  const peeked = $derived(peek && peek.during === game.waitingOn ? peek.player : null);
  const togglePeek = (id: string) => {
    peek = peeked === id ? null : { player: id, during: game.waitingOn };
  };

  const me = $derived(game.players.find((p) => p.id === you.id));
  const spotlight = $derived(game.players.find((p) => p.id === (peeked ?? game.waitingOn)));
  const others = $derived(game.players.filter((p) => p.id !== spotlight?.id && p.id !== you.id));
  const streakOf = (id: string) => (id === game.champion ? game.streak : 0);
</script>

<svelte:window bind:innerWidth />

{#snippet area(player: (typeof game.players)[number])}
  <PlayerArea
    {player}
    isYou={player.id === you.id}
    isCurrent={player.id === game.waitingOn}
    online={connected.includes(player.id)}
    drawn={game.drawn}
    streak={streakOf(player.id)}
  />
{/snippet}

<div class="table">
  <header class="bar">
    <span>Round {game.round}</span>
    <div class="tools">
      <SpectatorBar {spectators} />
      {#if seated}
        <button class="leave" class:confirming={confirmingLeave} onclick={leave}>
          {confirmingLeave ? "Forfeit" : "Leave"}
        </button>
      {/if}
      <AudioMenu bind:settings={audio} />
    </div>
  </header>

  <div class="piles" class:small={narrow}>
    <Piles deckCount={game.deckCount} discardCount={game.discardCount}>
      <!-- Action cards waiting on a target choice belong to no one yet, so they sit between the piles. -->
      {#if game.pending}
        <figure class="in-play">
          {#key game.pending.card.id}
            <div class="slot" in:drawFromDeck|global={{ order: game.drawn.indexOf(game.pending.card.id), count: game.drawn.length }} out:toDiscard|global>
              <Card card={game.pending.card} />
            </div>
          {/key}
          <figcaption>
            {game.pending.chooser === you.id ? "You" : name(game.pending.chooser)} drew {cardLabel(game.pending.card)}
          </figcaption>
        </figure>
      {/if}
    </Piles>
  </div>

  {#if spotlightLayout}
    {#if spotlight}
      {#key spotlight.id}
        <div in:fade={{ duration: 150 }}>{@render area(spotlight)}</div>
      {/key}
    {/if}
    {#if others.length}
      <div class="strip">
        {#each others as player (player.id)}
          <PlayerChip
            {player}
            isCurrent={player.id === game.waitingOn}
            isPeeked={player.id === peeked}
            online={connected.includes(player.id)}
            streak={streakOf(player.id)}
            onpeek={() => togglePeek(player.id)}
          />
        {/each}
      </div>
    {/if}
    {#if me && me.id !== spotlight?.id}
      {@render area(me)}
    {/if}
  {:else}
    <div class="players">
      {#each game.players as player (player.id)}
        {@render area(player)}
      {/each}
    </div>
  {/if}

  <footer class="controls">
    {#if timerDeadline && game.waitingOn}
      <TurnTimer
        deadline={timerDeadline}
        total={TURN_TIMEOUT_MS}
        label={game.waitingOn === you.id ? "Your turn" : `${name(game.waitingOn)}'s turn`}
        tick={game.waitingOn === you.id}
      />
    {:else if timerDeadline && game.phase === "roundOver"}
      <TurnTimer deadline={timerDeadline} total={NEXT_ROUND_DELAY_MS} label="Next round" tick={false} />
    {/if}
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
    {#each game.log.slice(narrow ? -2 : -6).reverse() as line}
      <li>{line}</li>
    {/each}
  </ol>
</div>

<style>
  .table {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 72rem;
    margin: 0 auto;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .leave {
    padding: 0.25rem 0.7rem;
    font-size: 0.8rem;
  }
  .leave.confirming {
    border-color: var(--danger);
    background: var(--danger);
    color: white;
  }
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 700;
  }
  .in-play {
    margin: 0;
    display: grid;
    justify-items: center;
    gap: 0.35rem;
    perspective: 800px;
  }
  figcaption {
    font-size: 0.8rem;
    color: var(--accent);
    white-space: nowrap;
  }
  .slot {
    position: relative;
    z-index: 1;
    transform-style: preserve-3d;
  }
  .players {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
    gap: 0.6rem;
  }
  /* zoom (unlike transform) also shrinks layout space, and transitions read the zoomed positions. */
  .piles.small {
    zoom: 0.72;
  }
  .strip {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.3rem;
  }
  /* Stays on screen when the players list is taller than a phone. */
  .controls {
    position: sticky;
    bottom: var(--safe-bottom);
    z-index: 3;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    min-height: 2.75rem;
    padding: 0.5rem 0;
    background: var(--bg);
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
