<script lang="ts">
  import { cn } from "$lib/utils";
  import type { GameView } from "../../game/view";
  import { roundScore } from "../../game/scoring";
  import type { User } from "../../shared/protocol";

  let { game, you }: { game: GameView; you: User } = $props();

  const name = (id: string) =>
    id === you.id
      ? "You"
      : (game.players.find((p) => p.id === id)?.name ?? "?");
  const me = $derived(game.players.find((p) => p.id === you.id));
  const roundNote = $derived(
    !me
      ? ""
      : me.status === "busted"
        ? "bust"
        : `+${roundScore(me.numbers, me.modifiers, me.draw7)}`,
  );
  const headline = $derived.by(() => {
    if (game.phase === "lobby") return `${game.players.length} in the lobby`;
    if (game.phase === "gameOver")
      return `${game.winners.map(name).join(" & ")} won!`;
    if (game.phase === "roundOver") return `Round ${game.round} over`;
    if (game.waitingOn === you.id) return "Your turn!";
    return game.waitingOn
      ? `${name(game.waitingOn)}'s turn`
      : `Round ${game.round}`;
  });
</script>

<div
  class={cn(
    "flex h-screen flex-col justify-center gap-1 overflow-hidden px-3.5 whitespace-nowrap",
    game.waitingOn === you.id && "ring-primary ring-3 ring-inset",
  )}
>
  <span class="text-muted-foreground text-xs tracking-widest uppercase"
    >Draw 7</span
  >
  <strong class="truncate text-xl">{headline}</strong>
  {#if me && game.phase !== "lobby"}
    <span class="text-muted-foreground"
      >{me.total} pts{game.phase === "playing"
        ? ` · this round ${roundNote}`
        : ""}</span
    >
  {/if}
</div>
