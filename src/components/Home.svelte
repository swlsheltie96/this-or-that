<script>
  import TickerTape from "./TickerTape.svelte";
  import HomeDropdown from "./HomeDropdown.svelte";
  import VotePreview from "./VotePreview.svelte";

  export let isMobile = false;

  let activeListName = "";
</script>

{#if !isMobile}
  <TickerTape {isMobile} />
  <div class="desktop-layout">
    <HomeDropdown on:activeList={(e) => (activeListName = e.detail.listName)}>
      <div class="main-area">
        <div class="text-top text-small"
          >A pairwise ranking tool powered by the Elo algorithm. Your ranking
          problems solved.</div
        >
        <div class="preview-wrap">
          <VotePreview listName={activeListName} />
        </div>
        <div class="text-bottom text-small"
          >click any list to start casting your vote</div
        >
      </div>
    </HomeDropdown>
  </div>
{/if}

<style>
  .desktop-layout {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .main-area {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    gap: var(--spacing-margin);

    width: 600px;
    margin: auto;
  }

  .preview-wrap {
    width: 100%;
    /* max-width: 480px; */
    pointer-events: auto;
  }

  .text-top,
  .text-bottom {
    text-transform: uppercase;
    text-align: center;
    padding: 0 var(--spacing-margin);
  }
</style>
