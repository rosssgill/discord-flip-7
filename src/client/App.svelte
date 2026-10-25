<script lang="ts">
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import * as Alert from "$lib/components/ui/alert";
  import { Toaster } from "$lib/components/ui/sonner";
  import { Spinner } from "$lib/components/ui/spinner";
  import * as Tooltip from "$lib/components/ui/tooltip";
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
    .catch(
      (error: unknown) =>
        (startError = error instanceof Error ? error.message : String(error)),
    );

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
    if (
      event.pointerType !== "mouse" ||
      !button ||
      button === enabledButton(event.relatedTarget)
    )
      return;
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

  const CONNECTION_TOAST = "connection";
  $effect(() => {
    if (!connection?.latest || !connection.you) return;
    if (!connection.connected)
      toast.loading("Reconnecting…", {
        id: CONNECTION_TOAST,
        duration: Infinity,
      });
    else if (connection.error)
      toast.error(connection.error, {
        id: CONNECTION_TOAST,
        duration: Infinity,
      });
    else toast.dismiss(CONNECTION_TOAST);
  });

  // Plain variable: the previous state is only compared against, never rendered.
  let previous: GameView | null = null;
  $effect(() => {
    const game = connection?.latest?.game;
    const you = connection?.you;
    if (!game || !you) return;
    if (!untrack(() => connection?.fresh))
      playCues(soundCues(previous, game, you.id));
    previous = game;
  });
</script>

<svelte:window
  bind:innerHeight
  onpointerdown={onPointerDown}
  onpointerover={onPointerOver}
  onkeydown={unlockAudio}
/>

<Tooltip.Provider>
  <main class={compact ? "h-screen overflow-hidden" : "p-4"}>
    {#if startError || connection?.fatal}
      <Alert.Root variant="destructive" class="mx-auto mt-[30vh] max-w-md">
        <Alert.Title>{startError ?? connection?.fatal}</Alert.Title>
      </Alert.Root>
    {:else if !connection?.latest || !connection.you}
      <p
        class="text-muted-foreground mt-[30vh] flex items-center justify-center gap-2"
      >
        <Spinner /> Connecting…
      </p>
    {:else}
      {@const { spectators, connected } = connection.latest}
      <!-- The first state after connecting replays nothing, so its draws appear in place instead of animating. -->
      {@const game = connection.fresh
        ? { ...connection.latest.game, drawn: [] }
        : connection.latest.game}
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
    {/if}
  </main>
  <Toaster theme="dark" position="bottom-center" />
</Tooltip.Provider>
