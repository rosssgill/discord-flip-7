<script lang="ts">
  import Volume1Icon from "@lucide/svelte/icons/volume-1";
  import Volume2Icon from "@lucide/svelte/icons/volume-2";
  import VolumeXIcon from "@lucide/svelte/icons/volume-x";
  import { Button } from "$lib/components/ui/button";
  import * as Popover from "$lib/components/ui/popover";
  import { Slider } from "$lib/components/ui/slider";
  import { Toggle } from "$lib/components/ui/toggle";
  import { type AudioSettings, type Channel, channelGain } from "../sounds";

  let { settings = $bindable() }: { settings: AudioSettings } = $props();

  const rows: { key: keyof AudioSettings; label: string }[] = [
    { key: "effects", label: "Sound effects" },
    { key: "music", label: "Music" },
  ];
  const silent = $derived(
    channelGain(settings.effects) === 0 && channelGain(settings.music) === 0,
  );
  const icon = (channel: Channel) =>
    channelGain(channel) === 0
      ? VolumeXIcon
      : channel.volume < 0.5
        ? Volume1Icon
        : Volume2Icon;

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
</script>

<Popover.Root>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="ghost"
        size="icon"
        aria-label="Sound settings"
      >
        {#if silent}<VolumeXIcon />{:else}<Volume2Icon />{/if}
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content align="end" class="w-56">
    <Popover.Header class="sr-only">
      <Popover.Title>Sound settings</Popover.Title>
    </Popover.Header>
    {#each rows as { key, label } (key)}
      {@const channel = settings[key]}
      {@const Icon = icon(channel)}
      <div class="flex items-center gap-2">
        <Toggle
          size="sm"
          bind:pressed={channel.muted}
          aria-label="{channel.muted ? 'Unmute' : 'Mute'} {label.toLowerCase()}"
        >
          <Icon />
        </Toggle>
        <div class="flex flex-1 flex-col gap-2">
          <span class="text-muted-foreground text-xs">{label}</span>
          <Slider
            type="single"
            min={0}
            max={1}
            step={0.05}
            aria-label={label}
            bind:value={
              () => (channel.muted ? 0 : channel.volume),
              (value) => slide(channel, value)
            }
          />
        </div>
      </div>
    {/each}
  </Popover.Content>
</Popover.Root>
