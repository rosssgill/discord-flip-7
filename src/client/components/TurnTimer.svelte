<script lang="ts">
  import TimerIcon from "@lucide/svelte/icons/timer";
  import { Progress } from "$lib/components/ui/progress";
  import { cn } from "$lib/utils";
  import { playCues } from "../sounds";

  let {
    deadline,
    total,
    label,
    tick,
  }: { deadline: number; total: number; label: string; tick: boolean } =
    $props();

  const TICK_FROM_S = 5;

  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 100);
    return () => clearInterval(timer);
  });

  const msLeft = $derived(Math.max(0, deadline - now));
  const seconds = $derived(Math.ceil(msLeft / 1000));
  const urgent = $derived(seconds <= TICK_FROM_S);

  // Only the player who has to act hears the clock, once per second.
  let lastTick = 0;
  $effect(() => {
    if (!tick || !urgent || seconds === 0 || seconds === lastTick) return;
    lastTick = seconds;
    playCues([{ sound: "tick", delayMs: 0 }]);
  });
</script>

<div
  class={cn("flex w-full flex-col gap-1", urgent && "urgent")}
  role="timer"
  aria-label="{label}: {seconds} seconds left"
>
  <Progress
    value={msLeft}
    max={total}
    class={cn(urgent && "*:data-[slot=progress-indicator]:bg-destructive")}
  />
  <span
    class={cn(
      "text-muted-foreground flex items-center gap-1 text-xs",
      urgent && "text-destructive font-bold",
    )}><TimerIcon class="size-3.5" /> {label} · {seconds}s</span
  >
</div>

<style>
  .urgent {
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.6;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .urgent {
      animation: none;
    }
  }
</style>
