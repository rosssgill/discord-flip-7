<script lang="ts">
  import { fade } from "svelte/transition";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { Button } from "$lib/components/ui/button";
  import type { GameView } from "../../game/view";
  import {
    type ClientMessage,
    NEXT_ROUND_DELAY_MS,
    TURN_TIMEOUT_MS,
    type User,
  } from "../../shared/protocol";
  import type { AudioSettings } from "../sounds";
  import { cardLabel } from "../../game/engine";
  import { drawFromDeck, toDiscard } from "../transitions";
  import Card from "./Card.svelte";
  import AudioMenu from "./AudioMenu.svelte";
  import RulesDialog from "./RulesDialog.svelte";
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

  // Leaving mid-game forfeits, so it asks for confirmation first.
  const midGame = $derived(
    game.phase === "playing" || game.phase === "roundOver",
  );

  const name = (id: string) =>
    game.players.find((p) => p.id === id)?.name ?? "?";
  const seated = $derived(game.players.some((p) => p.id === you.id));
  const myTurn = $derived(
    game.phase === "playing" && !game.pending && game.current === you.id,
  );
  const myChoice = $derived(
    game.pending?.chooser === you.id ? game.pending : null,
  );
  const prompts = {
    freeze: "Freeze who?",
    flipThree: "Who flips three?",
    giveSecondChance: "Give Second Chance to?",
  };

  // Phones and big tables get a spotlight on whoever is acting plus a strip of chips,
  // so up to 18 players fit without scrolling.
  const NARROW_MAX_WIDTH = 640;
  const MAX_FULL_PANELS = 8;
  let innerWidth = $state(window.innerWidth);
  const narrow = $derived(innerWidth < NARROW_MAX_WIDTH);
  const spotlightLayout = $derived(
    narrow || game.players.length > MAX_FULL_PANELS,
  );

  // A peek lasts until the game moves on to someone else.
  let peek = $state<{ player: string; during: string | null } | null>(null);
  const peeked = $derived(
    peek && peek.during === game.waitingOn ? peek.player : null,
  );
  const togglePeek = (id: string) => {
    peek = peeked === id ? null : { player: id, during: game.waitingOn };
  };

  const me = $derived(game.players.find((p) => p.id === you.id));
  const spotlight = $derived(
    game.players.find((p) => p.id === (peeked ?? game.waitingOn)),
  );
  const others = $derived(
    game.players.filter((p) => p.id !== spotlight?.id && p.id !== you.id),
  );
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

<div class="mx-auto flex max-w-6xl flex-col gap-3">
  <header class="flex items-center justify-between font-bold">
    <span>Round {game.round}</span>
    <div class="flex items-center gap-1.5">
      <SpectatorBar {spectators} />
      {#if seated && midGame}
        <AlertDialog.Root>
          <AlertDialog.Trigger>
            {#snippet child({ props })}
              <Button {...props} variant="outline" size="sm">Leave</Button>
            {/snippet}
          </AlertDialog.Trigger>
          <AlertDialog.Content>
            <AlertDialog.Header>
              <AlertDialog.Title>Leave the game?</AlertDialog.Title>
              <AlertDialog.Description>
                Leaving mid-game forfeits it.
              </AlertDialog.Description>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <AlertDialog.Cancel>Keep playing</AlertDialog.Cancel>
              <AlertDialog.Action
                variant="destructive"
                onclick={() => send({ type: "leave" })}
              >
                Forfeit
              </AlertDialog.Action>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog.Root>
      {/if}
      <RulesDialog />
      <AudioMenu bind:settings={audio} />
    </div>
  </header>

  <div class:small={narrow}>
    <Piles deckCount={game.deckCount} discardCount={game.discardCount}>
      <!-- Action cards waiting on a target choice belong to no one yet, so they sit between the piles. -->
      {#if game.pending}
        <figure class="in-play grid justify-items-center gap-1.5">
          {#key game.pending.card.id}
            <div
              class="slot"
              in:drawFromDeck|global={{
                order: game.drawn.indexOf(game.pending.card.id),
                count: game.drawn.length,
              }}
              out:toDiscard|global
            >
              <Card card={game.pending.card} />
            </div>
          {/key}
          <figcaption class="text-primary text-xs whitespace-nowrap">
            {game.pending.chooser === you.id
              ? "You"
              : name(game.pending.chooser)} drew {cardLabel(game.pending.card)}
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
      <div class="flex flex-wrap justify-center gap-1">
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
    <div class="grid grid-cols-[repeat(auto-fit,minmax(22rem,1fr))] gap-2.5">
      {#each game.players as player (player.id)}
        {@render area(player)}
      {/each}
    </div>
  {/if}

  <!-- Stays on screen when the players list is taller than a phone. -->
  <footer
    class="bg-background sticky bottom-(--safe-bottom) z-3 flex min-h-11 flex-wrap items-center gap-2 py-2"
  >
    {#if timerDeadline && game.waitingOn}
      <TurnTimer
        deadline={timerDeadline}
        total={TURN_TIMEOUT_MS}
        label={game.waitingOn === you.id
          ? "Your turn"
          : `${name(game.waitingOn)}'s turn`}
        tick={game.waitingOn === you.id}
      />
    {:else if timerDeadline && game.phase === "roundOver"}
      <TurnTimer
        deadline={timerDeadline}
        total={NEXT_ROUND_DELAY_MS}
        label="Next round"
        tick={false}
      />
    {/if}
    {#if game.phase === "gameOver"}
      <strong>{game.winners.map(name).join(" & ")} wins!</strong>
      <Button onclick={() => send({ type: "newGame" })}>New game</Button>
    {:else if game.phase === "roundOver"}
      <strong>Round {game.round} over</strong>
      {#if seated}
        <Button onclick={() => send({ type: "nextRound" })}>Next round</Button>
      {/if}
    {:else if myChoice}
      <strong>{prompts[myChoice.kind]}</strong>
      {#each myChoice.options as option (option)}
        <Button
          variant="outline"
          onclick={() => send({ type: "choose", target: option })}
        >
          {option === you.id ? "Me" : name(option)}
        </Button>
      {/each}
    {:else if myTurn}
      <Button onclick={() => send({ type: "hit" })}>Hit</Button>
      <Button variant="outline" onclick={() => send({ type: "stay" })}
        >Stay</Button
      >
    {:else if game.waitingOn}
      <span class="text-muted-foreground"
        >Waiting for {name(game.waitingOn)}…</span
      >
    {/if}
  </footer>

  <ol class="text-muted-foreground text-sm">
    {#each game.log.slice(narrow ? -2 : -6) as line}
      <li class="last:text-foreground">{line}</li>
    {/each}
  </ol>
</div>

<style>
  .in-play {
    perspective: 800px;
  }
  .slot {
    position: relative;
    z-index: 1;
    transform-style: preserve-3d;
  }
  /* zoom (unlike transform) also shrinks layout space, and transitions read the zoomed positions. */
  .small {
    zoom: 0.72;
  }
</style>
