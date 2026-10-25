<script lang="ts">
  import { MIN_PLAYERS } from "../../game/engine";
  import type { GameView } from "../../game/view";
  import type { ClientMessage, User } from "../../shared/protocol";
  import type { AudioSettings } from "../sounds";
  import Avatar from "./Avatar.svelte";
  import AudioMenu from "./AudioMenu.svelte";
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

<div class="lobby">
  <header>
    <h1><img class="logo" src="/logo.png" alt="Draw 7" /></h1>
    <div class="tools">
      <SpectatorBar {spectators} />
      <AudioMenu bind:settings={audio} />
    </div>
  </header>
  <p class="muted">
    Flip cards to get closest to 200 without busting on a duplicate number.
  </p>

  <h2>Players ({game.players.length})</h2>
  <ul class="seats">
    {#each game.players as player (player.id)}
      <li>
        <Avatar
          name={player.name}
          src={player.avatar}
          size={48}
          streak={player.id === game.champion ? game.streak : 0}
        />
        <span>{player.id === you.id ? "You" : player.name}</span>
      </li>
    {:else}
      <li class="muted">Nobody yet</li>
    {/each}
  </ul>

  <div class="actions">
    {#if seated}
      <button onclick={() => send({ type: "leave" })}>Leave</button>
      <button
        class="primary"
        disabled={game.players.length < MIN_PLAYERS}
        onclick={() => send({ type: "start" })}
      >
        Start game
      </button>
    {:else}
      <button class="primary" onclick={() => send({ type: "join" })}
        >Join game</button
      >
    {/if}
  </div>
</div>

<style>
  .lobby {
    max-width: 28rem;
    margin: 2rem auto;
  }
  header {
    position: relative;
    display: flex;
    justify-content: center;
  }
  .logo {
    display: block;
    width: min(10rem, 45vw);
  }
  .tools {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .seats {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 0;
    list-style: none;
  }
  .seats li {
    display: grid;
    justify-items: center;
    gap: 0.3rem;
    max-width: 5rem;
    font-size: 0.85rem;
    text-align: center;
    overflow-wrap: anywhere;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }
</style>
