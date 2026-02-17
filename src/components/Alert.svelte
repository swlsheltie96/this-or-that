<script>
  import { fade, fly } from 'svelte/transition';
  import { onDestroy } from 'svelte';

  export let message = "";
  export let visible = false;
  export let duration = 3000; // Auto-hide after 3 seconds

  let timer;

  // Auto-hide functionality
  $: if (visible && duration > 0) {
    console.log("Alert visible:", message);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      visible = false;
    }, duration);
  }

  onDestroy(() => {
    if (timer) clearTimeout(timer);
  });
</script>

{#if visible && message}
  <div
    class="alert-row"
    transition:fly="{{ y: -35, duration: 300 }}"
  >
    <div class="alert-cell">
      {message}
    </div>
  </div>
{/if}

<style>
  .alert-row {
    display: flex;
    height: var(--cell-height);
    border: var(--border);
    border-bottom: none;
    background: var(--color-white);
    margin-left: -1px;
  }

  .alert-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    font-family: var(--font-family);
    font-size: var(--font-size-header);
    padding: 0 var(--spacing-sm);
    text-transform: uppercase;
  }
</style>
