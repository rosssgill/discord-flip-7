<script lang="ts">
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

  let failed = $state(false);
  // A stable colour per name for the initial, since Activities can't load Discord's default avatars.
  // Multiplying by 137 spreads similar names (e.g. "P1", "P2") far apart on the colour wheel.
  const hue = $derived(
    ([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0) * 137) %
      360,
  );
</script>

<div class="avatar" class:offline style:--size="{size}px">
  {#if src && !failed}
    <img
      {src}
      alt=""
      width={size}
      height={size}
      onerror={() => (failed = true)}
    />
  {:else}
    <span class="initial" style:--hue={hue} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  {/if}
  {#if offline}
    <span class="disconnected" title="Disconnected" aria-label="Disconnected"
      >!</span
    >
  {/if}
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
  .avatar {
    position: relative;
  }
  .offline img,
  .offline .initial {
    filter: grayscale(1);
    opacity: 0.45;
  }
  .disconnected {
    position: absolute;
    right: -0.15rem;
    bottom: -0.15rem;
    display: grid;
    place-items: center;
    width: calc(var(--size) * 0.42);
    height: calc(var(--size) * 0.42);
    border-radius: 50%;
    border: 2px solid var(--panel);
    background: var(--danger);
    color: white;
    font-size: calc(var(--size) * 0.28);
    font-weight: 900;
  }
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
    color: var(--accent);
  }
  img,
  .initial {
    display: block;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    flex-shrink: 0;
  }
  .initial {
    display: grid;
    place-items: center;
    background: hsl(var(--hue) 45% 45%);
    color: white;
    font-weight: 800;
    font-size: calc(var(--size) * 0.45);
  }
</style>
