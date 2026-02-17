<script>
  export let items = [];
  export let viewSize = "small"; // 'small', 'medium', 'large'
  import Card from "./Card.svelte";
  $: columnCount = viewSize === "small" ? 8 : viewSize === "medium" ? 6 : 4;
</script>

<div class="card-container" style="--columns: {columnCount}">
  {#each items as item, index}
    <Card {item} index={index + 1} {viewSize} isFirstRow={index < columnCount} />
  {/each}
</div>

<style>
  .card-container {
    display: grid;
    gap: 0;
    width: 100%;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
    box-sizing: border-box;
    background-color: var(--color-white);
  }
</style>
