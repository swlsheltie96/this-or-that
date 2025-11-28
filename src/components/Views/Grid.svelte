<script>
  export let items = [];
  export let viewSize = "small"; // 'small', 'medium', 'large'
  import Card from "./Card.svelte";
  $: columnCount = viewSize === "small" ? 8 : viewSize === "medium" ? 6 : 4;
</script>

<div class="card-container box {viewSize}" style="--columns: {columnCount}">
  {#each items as item, index}
    <Card {item} index={index + 1} {viewSize} />
  {/each}
</div>

<style>
  .card-container {
    display: grid;
    gap: 5px;
    width: calc(100% - 4px);
    grid-template-columns: repeat(var(--columns), 1fr);
  }
</style>
