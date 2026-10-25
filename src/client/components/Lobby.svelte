<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import * as Empty from "$lib/components/ui/empty";
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

<Card.Root class="mx-auto my-8 max-w-md">
  <Card.Header>
    <Card.Title>
      <h1><img class="w-[min(10rem,45vw)]" src="/logo.png" alt="Draw 7" /></h1>
    </Card.Title>
    <Card.Description>
      Flip cards to get closest to 200 without busting on a duplicate number.
    </Card.Description>
    <Card.Action class="flex items-center gap-1">
      <SpectatorBar {spectators} />
      <AudioMenu bind:settings={audio} />
    </Card.Action>
  </Card.Header>

  <Card.Content>
    <h2 class="font-semibold">Players ({game.players.length})</h2>
    {#if game.players.length}
      <ul class="flex flex-wrap gap-4">
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
        {/each}
      </ul>
    {:else}
      <Empty.Root>
        <Empty.Header>
          <Empty.Title>Nobody yet</Empty.Title>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </Card.Content>

  <Card.Footer class="gap-2">
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
  </Card.Footer>
</Card.Root>
