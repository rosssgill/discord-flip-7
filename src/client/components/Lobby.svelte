<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { MIN_PLAYERS } from "../../game/engine";
  import type { GameView } from "../../game/view";
  import type { ClientMessage, User } from "../../shared/protocol";
  import type { AudioSettings } from "../sounds";
  import Avatar from "./Avatar.svelte";
  import AudioMenu from "./AudioMenu.svelte";
  import RulesDialog from "./RulesDialog.svelte";
  import SpectatorBar from "./SpectatorBar.svelte";

  let {
    game,
    spectators,
    you,
    send,
    audio = $bindable(),
  }: {
    game: GameView;
    spectators: User[];
    you: User;
    send: (m: ClientMessage) => void;
    audio: AudioSettings;
  } = $props();

  const seated = $derived(game.players.some((p) => p.id === you.id));
</script>

<div class="mx-auto my-8 flex max-w-md flex-col items-center gap-4 text-center">
  <!-- On phones the toolbar gets its own row so it doesn't overlap the logo. -->
  <header class="relative flex w-full flex-col-reverse items-center gap-2">
    <h1><img class="w-[min(10rem,45vw)]" src="/logo.png" alt="Draw 7" /></h1>
    <div class="flex w-full items-center sm:absolute sm:inset-x-0 sm:top-0">
      <SpectatorBar {spectators} />
      <div class="ml-auto flex items-center gap-1">
        <RulesDialog />
        <AudioMenu bind:settings={audio} />
      </div>
    </div>
  </header>
  <p class="text-muted-foreground">
    Flip cards to get closest to 200 without busting on a duplicate number.
  </p>

  <h2 class="text-xl font-bold">Players ({game.players.length})</h2>
  <!-- Top margin leaves room for the champion's crown above the avatar. -->
  <ul class="mt-2 flex flex-wrap justify-center gap-4">
    {#each game.players as player (player.id)}
      <li
        class="flex max-w-20 flex-col items-center gap-1 text-center text-sm wrap-anywhere"
      >
        <Avatar
          name={player.name}
          src={player.avatar}
          size={48}
          streak={player.id === game.champion ? game.streak : 0}
        />
        <span>{player.id === you.id ? "You" : player.name}</span>
      </li>
    {:else}
      <li class="text-muted-foreground">Nobody yet</li>
    {/each}
  </ul>

  <div class="mt-2 flex gap-2">
    {#if seated}
      <Button variant="outline" onclick={() => send({ type: "leave" })}>
        Leave
      </Button>
      <Button
        disabled={game.players.length < MIN_PLAYERS}
        onclick={() => send({ type: "start" })}
      >
        Start game
      </Button>
    {:else}
      <Button onclick={() => send({ type: "join" })}>Join game</Button>
    {/if}
  </div>
</div>
