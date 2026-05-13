<script>
  import { createEventDispatcher } from "svelte";
  export let item;
  export let index;
  export let viewSize = "small"; // 'small', 'medium', 'large'
  export let isFirstRow = false;

  const dispatch = createEventDispatcher();

  // Parse JSON data - handle both string and object cases
  $: parsedData = item.data
    ? typeof item.data === "string"
      ? JSON.parse(item.data)
      : item.data
    : null;
</script>

<div class="card" class:first-row={isFirstRow} on:click={() => dispatch("select", { item, index })}>
  <div class="picture-row">
    {#if parsedData?.picture}
      <img src={parsedData.picture} alt={item.name} />
    {/if}
    <div class="badge-container">     
      <div class="badge-container-left">
        <span class="badge badge-rank">{index}</span>
        <span class="badge badge-name">{item.name}</span>
      </div>
      <div class="badge-container-right">
          <span class="badge badge-elo">{Math.round(item.elo)}</span>
      </div>
    </div>
  </div>
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
    position: relative;
  }

  /* Remove top border from first row */
  .card.first-row {
    border-top: none;
  }

  .picture-row {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    padding: var(--spacing-sm);
    overflow: hidden;
    box-sizing: border-box;
  }

  .picture-row img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .badge-container {
    display: flex;
    gap: var(--spacing-xs);
    position: absolute;
    top: 5px;
    left: 10px;
    width: calc(100% - 20px);
    justify-content: space-between;
  }

  .card:hover .badge-container {
    opacity: 0.5;
  }

  .badge-rank {
    /* left: 10px; */
  }

  .badge-name {
    /* left: 50%; */
    /* transform: translateX(-50%); */
  }

  .badge-elo {
    /* right: 10px; */
  }
</style>
