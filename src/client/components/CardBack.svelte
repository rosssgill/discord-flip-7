<script lang="ts">
  // Script block lets svelte-check generate types for this markup-only component.
</script>

<div class="back"><span>7</span></div>

<style>
  .back {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 4.2rem;
    box-sizing: border-box;
    border-radius: 0.5rem;
    border: 3px solid var(--card-bg);
    background: repeating-linear-gradient(45deg, var(--action) 0 6px, #a3360a 6px 12px);
    box-shadow: 0 2px 4px rgb(0 0 0 / 0.3);
  }
  span {
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    background: var(--card-bg);
    color: var(--action);
    font-weight: 900;
  }
</style>
