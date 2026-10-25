<script lang="ts">
  import { Toggle } from "$lib/components/ui/toggle";
  import { cn } from "$lib/utils";
  import type { Player } from "../../game/engine";
  import { roundScore } from "../../game/scoring";
  import Avatar from "./Avatar.svelte";

  let {
    player,
    isCurrent,
    isPeeked,
    online,
    streak,
    onpeek,
  }: {
    player: Player;
    isCurrent: boolean;
    isPeeked: boolean;
    online: boolean;
    streak: number;
    onpeek: () => void;
  } = $props();

  const detail = $derived.by(() => {
    if (player.draw7) return "Draw 7!";
    if (player.status === "busted") return "Bust";
    if (player.status === "frozen") return "❄ Frozen";
    const points = `+${player.lastRoundScore ?? roundScore(player.numbers, player.modifiers, false)}`;
    return player.status === "stayed" ? `${points} ✓` : points;
  });
</script>

<Toggle
  pressed={isPeeked}
  onPressedChange={onpeek}
  aria-label="Show {player.name}'s cards"
  class={cn(
    "bg-card h-auto w-13 flex-col gap-0 px-0.5 pt-1.5 pb-1 font-normal",
    isCurrent && "ring-primary ring-2",
    player.status === "frozen" &&
      "ring-ice shadow-[inset_0_0_10px_var(--ice)] ring-2",
  )}
>
  <Avatar
    name={player.name}
    src={player.avatar}
    size={28}
    {streak}
    offline={!online}
  />
  <span class="mt-0.5 max-w-full truncate text-[0.65rem]">{player.name}</span>
  <span class="text-sm leading-tight font-extrabold">{player.total}</span>
  <span
    class={cn(
      "text-muted-foreground text-[0.6rem]",
      player.status === "busted" && "text-destructive",
      player.status === "frozen" && "text-ice",
    )}>{detail}</span
  >
</Toggle>
