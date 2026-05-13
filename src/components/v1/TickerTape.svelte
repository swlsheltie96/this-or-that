<script>
  export let lists = [];

  $: items = lists
    .filter((l) => l.itemsList)
    .map((l) => ({
      listName: l.name,
      itemName: l.itemsList.split(", ")[0],
      count: l.itemCount || 0,
      color: l.accentColor || "green",
    }));
</script>

{#if items.length > 0}
  <div class="ticker-wrap">
    <!-- Duplicate items for seamless loop -->
    <div class="ticker-track">
      {#each [...items, ...items] as item}
        <div class="ticker-entry">
          <span class="badge" style="background-color: {item.color}">{item.listName.toUpperCase()}</span>
          <span class="item-name">{item.itemName}</span>
          <span class="ticker-stat">
            <span class="arrow" style="color: {item.color}">▲</span>
            <span class="count" style="color: {item.color}">{item.count}</span>
          </span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .ticker-wrap {
    width: 100%;
    overflow: hidden;
    border-bottom: var(--border);
    height: var(--cell-height);
    display: flex;
    align-items: center;
    box-sizing: border-box;
  }

  .ticker-track {
    display: flex;
    gap: var(--spacing-md);
    align-items: center;
    width: max-content;
    animation: ticker-scroll 40s linear infinite;
    padding: 0 var(--spacing-sm);
  }

  .ticker-track:hover {
    animation-play-state: paused;
  }

  @keyframes ticker-scroll {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }

  .ticker-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .badge {
    color: var(--color-black);
    font-family: var(--font-family);
    font-size: var(--font-size-header);
    padding: 0 var(--spacing-md);
    border-radius: var(--border-radius-button);
    height: 20px;
    display: flex;
    align-items: center;
    white-space: nowrap;
  }

  .item-name {
    font-family: var(--font-family);
    font-size: var(--font-size-content);
    color: var(--color-black);
    white-space: nowrap;
  }

  .ticker-stat {
    display: flex;
    align-items: flex-end;
    gap: 2px;
  }

  .arrow {
    font-size: 10px;
    line-height: 1;
    margin-bottom: 3px;
  }

  .count {
    font-family: var(--font-family);
    font-size: var(--font-size-content);
    white-space: nowrap;
  }
</style>
