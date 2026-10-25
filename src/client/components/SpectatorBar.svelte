<script lang="ts">
  import type { User } from "../../shared/protocol";
  import Avatar from "./Avatar.svelte";

  let { spectators }: { spectators: User[] } = $props();

  const SHOWN = 4;
  const shown = $derived(spectators.slice(0, SHOWN));
  const hidden = $derived(spectators.length - shown.length);
</script>

{#if spectators.length}
  <div
    class="spectators"
    title="Watching: {spectators.map((s) => s.name).join(', ')}"
  >
    <div class="stack">
      {#each shown as user (user.id)}
        <div class="face">
          <Avatar name={user.name} src={user.avatar} size={24} />
        </div>
      {/each}
    </div>
    {#if hidden > 0}<span class="more">+{hidden}</span>{/if}
    <span class="sr-only">{spectators.length} watching</span>
  </div>
{/if}

<style>
  .spectators {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.15rem 0.5rem 0.15rem 0.2rem;
    border-radius: 1rem;
    background: var(--panel);
    font-size: 0.75rem;
  }
  .stack {
    display: flex;
  }
  .face + .face {
    margin-left: -0.45rem;
  }
  .face {
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--panel);
  }
  .more {
    color: var(--muted);
    font-weight: 700;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
