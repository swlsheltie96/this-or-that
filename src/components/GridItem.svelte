<script>
  export let rank = 0;
  export let elo = 1000;
  export let name = "";
  export let picture = null;
</script>

<div class="grid-item">
  <div class="grid-item-meta">
    <span class="text-small rank">{rank}</span>
    <span class="text-small elo">{Math.round(elo)}</span>
  </div>
  <div class="grid-item-image">
    {#if picture}
      <img src={picture} alt={name} loading="lazy" />
    {:else}
      <div class="img-empty"></div>
    {/if}
  </div>
  <div class="text-small grid-item-name">{name}</div>
</div>

<style>
  .grid-item {
    border: var(--border);
    border-radius: 4px;
    padding: var(--spacing-margin);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    flex: 1;
    min-width: 0;
  }

  .grid-item-meta {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .grid-item-image {
    width: 100%;
    aspect-ratio: 1 / 1;
    overflow: hidden;
  }

  .grid-item-image img,
  .img-empty {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .img-empty {
    background: var(--color-grey);
  }

  .grid-item-name {
    text-transform: uppercase;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>
