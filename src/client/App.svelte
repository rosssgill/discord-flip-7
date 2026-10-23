<script lang="ts">
  import { untrack } from "svelte";
  import Lobby from "./components/Lobby.svelte";
  import Table from "./components/Table.svelte";
  import type { GameView } from "../game/view";
  import Compact from "./components/Compact.svelte";
  import { Connection } from "./connection.svelte";
  import { soundCues } from "./cues";
  import { startSession } from "./session";
  import {
    channelGain,
    loadAudioSettings,
    playCues,
    saveAudioSettings,
    setEffectsGain,
    setMusic,
    setMusicGain,
    unlockAudio,
  } from "./sounds";

  let connection = $state<Connection | null>(null);
  let startError = $state<string | null>(null);

  startSession()
    .then((session) => (connection = new Connection(session)))
    .catch((error: unknown) => (startError = error instanceof Error ? error.message : String(error)));

  // Discord shrinks the Activity to a small tile while you browse other channels.
  const COMPACT_MAX_HEIGHT = 320;
  let innerHeight = $state(window.innerHeight);
  const compact = $derived(innerHeight < COMPACT_MAX_HEIGHT);

  const send: Connection["send"] = (message) => connection?.send(message);

  const enabledButton = (target: EventTarget | null) =>
    target instanceof Element ? target.closest("button:not(:disabled)") : null;

  function onPointerDown(event: PointerEvent) {
    unlockAudio();
    if (enabledButton(event.target)) playCues([{ sound: "click", delayMs: 0 }]);
  }

  // Mouse only: touch screens fire pointerover on tap, which would double up with the click sound.
  function onPointerOver(event: PointerEvent) {
    const button = enabledButton(event.target);
    if (event.pointerType !== "mouse" || !button || button === enabledButton(event.relatedTarget)) return;
    playCues([{ sound: "hover", delayMs: 0 }]);
  }

  let audio = $state(loadAudioSettings());
  $effect(() => {
    saveAudioSettings(audio);
    setEffectsGain(channelGain(audio.effects));
    setMusicGain(channelGain(audio.music));
  });
  const musicOn = $derived(channelGain(audio.music) > 0);
  $effect(() => {
    setMusic(musicOn && connection?.latest?.game.phase === "lobby");
  });

  // Plain variable: the previous state is only compared against, never rendered.
  let previous: GameView | null = null;
  $effect(() => {
    const game = connection?.latest?.game;
    const you = connection?.you;
    if (!game || !you) return;
    if (!untrack(() => connection?.fresh)) playCues(soundCues(previous, game, you.id));
    previous = game;
  });
</script>

<svelte:window
  bind:innerHeight
  onpointerdown={onPointerDown}
  onpointerover={onPointerOver}
  onkeydown={unlockAudio}
/>

<main class:compact>
  {#if startError || connection?.fatal}
    <p class="notice">{startError ?? connection?.fatal}</p>
  {:else if !connection?.latest || !connection.you}
    <p class="notice muted">Connecting…</p>
  {:else}
    {@const { spectators, connected } = connection.latest}
    <!-- The first state after connecting replays nothing, so its draws appear in place instead of animating. -->
    {@const game = connection.fresh ? { ...connection.latest.game, drawn: [] } : connection.latest.game}
    {#if compact}
      <Compact {game} you={connection.you} />
    {:else if game.phase === "lobby"}
      <Lobby {game} {spectators} you={connection.you} {send} bind:audio />
    {:else}
      <Table
        {game}
        you={connection.you}
        {connected}
        {send}
        bind:audio
        {spectators}
        timerDeadline={connection.timerDeadline}
      />
    {/if}
    {#if !connection.connected}
      <p class="toast">Reconnecting…</p>
    {:else if connection.error}
      <p class="toast">{connection.error}</p>
    {/if}
  {/if}
</main>

<style>
  main {
    padding: 1rem;
  }
  main.compact {
    padding: 0;
    height: 100vh;
    overflow: hidden;
  }
  .compact .notice {
    margin-top: 0;
    line-height: 100vh;
  }
  .notice {
    text-align: center;
    margin-top: 30vh;
  }
  .toast {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--panel);
    border: 1px solid var(--accent);
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
  }
</style>
