<script lang="ts">
  import Lobby from "./components/Lobby.svelte";
  import Table from "./components/Table.svelte";
  import { Connection } from "./connection.svelte";
  import { startSession } from "./session";

  let connection = $state<Connection | null>(null);
  let startError = $state<string | null>(null);

  startSession()
    .then((session) => (connection = new Connection(session)))
    .catch((error: unknown) => (startError = error instanceof Error ? error.message : String(error)));

  const send: Connection["send"] = (message) => connection?.send(message);
</script>

<main>
  {#if startError || connection?.fatal}
    <p class="notice">{startError ?? connection?.fatal}</p>
  {:else if !connection?.latest || !connection.you}
    <p class="notice muted">Connecting…</p>
  {:else}
    {@const { game, spectators, connected } = connection.latest}
    {#if game.phase === "lobby"}
      <Lobby {game} {spectators} you={connection.you} {send} />
    {:else}
      <Table {game} you={connection.you} {connected} {send} />
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
