<script>
  export let item;
  export let index;
  export let viewSize = "small"; // 'small', 'medium', 'large'
  export let isFirstRow = false;

  // Parse JSON data - handle both string and object cases
  $: parsedData = item.data
    ? typeof item.data === "string"
      ? JSON.parse(item.data)
      : item.data
    : null;
  $: description = parsedData?.description || "";
</script>

<div class="card" class:first-row={isFirstRow}>
  <div class="card-row picture-row">
    {#if parsedData?.picture}
      <img src={parsedData.picture} alt={item.name} />
    {/if}
  </div>

  <div class="card-row rank-row">{index}</div>
  <div class="card-row score-row">{Math.round(item.elo)}</div>

  <div class="card-row name-row">{item.name}</div>

  {#if description}
    <div class="card-row description-row">{description}</div>
  {/if}
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    border: var(--border);
    margin-right: -1px;
    margin-bottom: -1px;
    box-sizing: border-box;
    background-color: var(--color-white);
  }

  /* Remove top border from first row */
  .card.first-row {
    border-top: none;
  }

  .card-row {
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: var(--border);
    padding: var(--spacing-sm);
    box-sizing: border-box;
    font-family: var(--font-family);
  }

  .card-row:last-child {
    border-bottom: none;
  }

  .rank-row,
  .score-row {
    font-size: var(--font-size-header);
    color: var(--color-text-primary);
    text-align: center;
    height: calc(var(--cell-height) / 2);
  }

  .picture-row {
    width: 100%;
    aspect-ratio: 1 / 1;
    padding: var(--spacing-sm);
    overflow: hidden;
  }

  .picture-row img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .name-row {
    font-size: var(--font-size-content);
    color: var(--color-text-primary);
    text-align: center;
    width: 100%;
    overflow: hidden;
    white-space: nowrap;
  }

  .description-row {
    font-size: var(--font-size-header);
    color: var(--color-text-primary);
    text-align: left;
    width: 100%;
    justify-content: flex-start;
  }
</style>
