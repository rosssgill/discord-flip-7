<script lang="ts">
  import type { Card } from "../../game/cards";
  import { cardLabel } from "../../game/engine";

  let { card }: { card: Card } = $props();
  const hue = $derived(card.kind === "number" ? (card.value * 29) % 360 : 0);
</script>

<div class="card {card.kind}" style:--hue={hue}>
  <span class="label">{cardLabel(card)}</span>
</div>

<style>
  .card {
    --hue: 0;
    display: grid;
    place-items: center;
    width: 3rem;
    height: 4.2rem;
    border-radius: 0.5rem;
    background: var(--card-bg);
    border: 2px solid hsl(var(--hue) 60% 50%);
    color: hsl(var(--hue) 60% 35%);
    box-shadow: 0 2px 4px rgb(0 0 0 / 0.3);
    font-weight: 800;
    text-align: center;
    user-select: none;
  }
  .number .label {
    font-size: 1.6rem;
  }
  .modifier {
    border-color: var(--modifier);
    color: var(--modifier);
    font-size: 1.1rem;
  }
  .action {
    border-color: var(--action);
    color: var(--action);
    font-size: 0.7rem;
    line-height: 1.1;
    padding: 0.2rem;
  }
</style>
