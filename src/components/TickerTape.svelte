<script>
  import { onMount, onDestroy } from "svelte";
  import { getRecentChanges } from "../lib/api.js";
  import { onTick } from "../lib/sharedTick.js";

  export let isMobile = false;

  let items = [];
  let trackEl;
  let paused = false;
  let position = 0;
  let unsubTick;
  let tickerHeight = 0;

  $: document.documentElement.style.setProperty(
    "--ticker-height",
    tickerHeight + "px",
  );

  onMount(async () => {
    try {
      const { changes } = await getRecentChanges();
      items = changes;
    } catch (e) {
      console.error(e);
    }

    unsubTick = onTick(() => {
      if (paused || !trackEl) return;
      position -= 5;
      const halfWidth = trackEl.scrollWidth / 2;
      if (Math.abs(position) >= halfWidth) position = 0;
      trackEl.style.transform = `translateX(${position}px)`;
    });
  });

  onDestroy(() => unsubTick?.());
</script>

{#if items.length > 0}
  <div
    class="ticker-wrap"
    class:mobile={isMobile}
    bind:clientHeight={tickerHeight}
  >
    <div
      class="ticker-track"
      bind:this={trackEl}
      on:mouseenter={() => (paused = true)}
      on:mouseleave={() => (paused = false)}
    >
      {#each [...items, ...items] as item}
        <div class="ticker-entry">
          <span class="list-name text-small"
            >{item.list_name.toUpperCase()}</span
          >
          <span class="item-name text-base">{item.item_name}</span>
          <span
            class="ticker-stat text-base"
            class:positive={item.delta >= 0}
            class:negative={item.delta < 0}
          >
            <span class="arrow text-small">{item.delta >= 0 ? "⏶" : "⏷"}</span
            >{Math.abs(item.delta)}
          </span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .ticker-wrap {
    border-bottom: var(--border);
    display: flex;
    align-items: center;
    padding: var(--spacing-margin) 0;
    width: 100vw;
    overflow: hidden;
  }

  .ticker-track {
    display: flex;
    gap: var(--spacing-lg);
    align-items: center;
    width: max-content;
    padding: 0 var(--spacing-sm);
  }

  .ticker-entry {
    display: flex;
    gap: var(--spacing-md);
    white-space: nowrap;
    align-items: stretch;
  }

  .list-name {
    color: var(--color-white);
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: var(--color-grey);
    padding: 0 var(--spacing-sm);
  }
  @media (min-width: 740px) {
    .list-name {
      padding-top: 2px;
    }
  }

  .item-name {
    color: var(--color-black);
  }

  .ticker-stat {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .ticker-stat.positive {
    color: var(--color-green);
  }
  .ticker-stat.negative {
    color: var(--color-red);
  }

  .arrow {
    display: inline-block;
  }
</style>
