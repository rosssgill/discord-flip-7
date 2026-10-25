<script lang="ts">
  import * as Avatar from "$lib/components/ui/avatar";
  import { cn } from "$lib/utils";

  let {
    name,
    src,
    size = 40,
    streak = 0,
    offline = false,
  }: {
    name: string;
    src: string | null;
    size?: number;
    streak?: number;
    offline?: boolean;
  } = $props();

  // A stable colour per name for the initial, since Activities can't load Discord's default avatars.
  // Multiplying by 137 spreads similar names (e.g. "P1", "P2") far apart on the colour wheel.
  const hue = $derived(
    ([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0) * 137) %
      360,
  );
  const dimmed = $derived(offline && "opacity-45 grayscale");
</script>

<div class="relative" style:--size="{size}px">
  <Avatar.Root class="size-(--size)">
    {#if src}
      <Avatar.Image {src} alt="" class={cn(dimmed)} />
    {/if}
    <Avatar.Fallback
      class={cn(
        "text-[calc(var(--size)*0.45)] font-extrabold text-white",
        dimmed,
      )}
      style="background: hsl({hue} 45% 45%)"
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </Avatar.Fallback>
    {#if offline}
      <Avatar.Badge
        class="bg-destructive ring-card -right-0.5 -bottom-0.5 size-[calc(var(--size)*0.42)]! text-[calc(var(--size)*0.28)] font-black text-white"
        title="Disconnected"
        aria-label="Disconnected">!</Avatar.Badge
      >
    {/if}
  </Avatar.Root>
  {#if streak > 0}
    <span
      class="crown"
      title={streak > 1
        ? `Won the last ${streak} games in a row`
        : "Won the last game"}
    >
      👑{#if streak > 1}<sub>{streak}</sub>{/if}
    </span>
  {/if}
</div>

<style>
  .crown {
    position: absolute;
    top: calc(var(--size) * -0.42);
    left: 50%;
    transform: translateX(-50%) rotate(-12deg);
    font-size: calc(var(--size) * 0.5);
    line-height: 1;
    filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.5));
    white-space: nowrap;
  }
  .crown sub {
    font-size: 0.45em;
    font-weight: 800;
    color: var(--primary);
  }
</style>
