<script lang="ts">
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
  class="timer"
  class:urgent
  role="timer"
  aria-label="{label}: {seconds} seconds left"
>
  <div class="track">
    <div class="fill" style:width="{(msLeft / total) * 100}%"></div>
  </div>
  <span class="text">⏱ {label} · {seconds}s</span>
</div>

<style>
  .timer {
    display: grid;
    gap: 0.25rem;
    width: 100%;
  }
  .track {
    height: 0.35rem;
    border-radius: 1rem;
    background: var(--panel);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.1s linear;
  }
  .text {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .urgent .fill {
    background: var(--danger);
  }
  .urgent .text {
    color: var(--danger);
    font-weight: 700;
  }
  .urgent.timer {
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.6;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .urgent.timer {
      animation: none;
    }
  }
</style>
