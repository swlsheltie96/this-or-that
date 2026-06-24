<script>
  export let rank = 0;
  export let elo = 1000;
  export let name = "";
  export let picture = null;
  export let noImages = false;
</script>

<div class="list-view-item">
  {#if !noImages}
    <div class="image-wrap">
      {#if picture}
        <img src={picture} alt={name} loading="lazy" />
      {:else}
        <div class="img-empty"></div>
      {/if}
    </div>
  {/if}
  <span class="text-small rank">{rank}</span>
  <span class="text-small item-name">{name}</span>
  <span class="text-small elo">{Math.round(elo)}</span>
</div>

<style>
  .list-view-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding-bottom: var(--spacing-sm);
    border-bottom: var(--border);
    min-height: 75px;
  }

  .image-wrap {
    width: 75px;
    height: 75px;
    flex-shrink: 0;
    overflow: hidden;
  }

  .image-wrap img,
  .img-empty {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .img-empty {
    background: var(--color-grey);
  }

  .rank {
    flex-shrink: 0;
  }

  .item-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-transform: uppercase;
  }

  .elo {
    flex-shrink: 0;
    width: 4ch;
    text-align: right;
  }
</style>
