<script lang="ts">
  import EyeIcon from "@lucide/svelte/icons/eye";
  import { Badge } from "$lib/components/ui/badge";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import type { User } from "../../shared/protocol";
  import Avatar from "./Avatar.svelte";

  let { spectators }: { spectators: User[] } = $props();

  const SHOWN = 4;
  const shown = $derived(spectators.slice(0, SHOWN));
  const hidden = $derived(spectators.length - shown.length);
</script>

{#if spectators.length}
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Badge {...props} variant="secondary" class="h-7 gap-1.5">
          <EyeIcon data-icon="inline-start" />
          <span class="flex -space-x-2">
            {#each shown as user (user.id)}
              <span class="ring-secondary rounded-full ring-2">
                <Avatar name={user.name} src={user.avatar} size={24} />
              </span>
            {/each}
          </span>
          {#if hidden > 0}
            <span class="text-muted-foreground font-bold">+{hidden}</span>
          {/if}
          <span class="sr-only">{spectators.length} watching</span>
        </Badge>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>
      Watching: {spectators.map((s) => s.name).join(", ")}
    </Tooltip.Content>
  </Tooltip.Root>
{/if}
