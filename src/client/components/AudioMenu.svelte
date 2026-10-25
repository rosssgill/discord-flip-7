<script lang="ts">
  import { type AudioSettings, type Channel, channelGain } from "../sounds";

  let { settings = $bindable() }: { settings: AudioSettings } = $props();

  let open = $state(false);
  let root: HTMLElement;

  const rows: { key: keyof AudioSettings; label: string }[] = [
    { key: "effects", label: "Sound effects" },
    { key: "music", label: "Music" },
  ];
  const silent = $derived(
    channelGain(settings.effects) === 0 && channelGain(settings.music) === 0,
  );
  const icon = (channel: Channel) =>
    channelGain(channel) === 0 ? "🔇" : channel.volume < 0.5 ? "🔉" : "🔊";

  // Muting shows the slider at 0 but keeps the volume, so unmuting returns to where it was.
  // Dragging to 0 mutes; dragging up from 0 unmutes.
  function slide(channel: Channel, value: number) {
    if (value === 0) {
      channel.muted = true;
    } else {
      channel.volume = value;
      channel.muted = false;
    }
  }

  function closeOnOutside(event: PointerEvent) {
    if (open && !root.contains(event.target as Node)) open = false;
  }
</script>

<svelte:window
  onpointerdown={closeOnOutside}
  onkeydown={(e) => e.key === "Escape" && (open = false)}
/>

<div class="audio" bind:this={root}>
  <button
    class="toggle"
    onclick={() => (open = !open)}
    aria-expanded={open}
    aria-label="Sound settings"
  >
    {silent ? "🔇" : "🔊"}
  </button>
  {#if open}
    <div class="menu" role="dialog" aria-label="Sound settings">
      {#each rows as { key, label } (key)}
        {@const channel = settings[key]}
        <div class="row">
          <button
            class="mute"
            onclick={() => (channel.muted = !channel.muted)}
            aria-pressed={channel.muted}
            aria-label="{channel.muted
              ? 'Unmute'
              : 'Mute'} {label.toLowerCase()}"
          >
            {icon(channel)}
          </button>
          <label>
            <span>{label}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={channel.muted ? 0 : channel.volume}
              oninput={(e) => slide(channel, Number(e.currentTarget.value))}
            />
          </label>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .audio {
    position: relative;
  }
  button {
    padding: 0.2rem 0.5rem;
    border: none;
  }
  .menu {
    position: absolute;
    top: calc(100% + 0.4rem);
    right: 0;
    z-index: 10;
    display: grid;
    gap: 0.6rem;
    width: 14rem;
    padding: 0.75rem;
    border-radius: 0.6rem;
    background: var(--panel);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.4);
    font-weight: 400;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  label {
    display: grid;
    flex: 1;
    gap: 0.15rem;
    font-size: 0.8rem;
    color: var(--muted);
  }
  input {
    width: 100%;
    accent-color: var(--accent);
  }
</style>
