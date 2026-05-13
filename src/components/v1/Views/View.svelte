<script>
  import List from "./List.svelte";
  import Grid from "./Grid.svelte";
  import EloChart from "./EloChart.svelte";
  import { getEloHistory } from "../../../lib/api.js";

  export let items = [];
  export let listName = "";
  export let listInfo = {};
  export let viewSize = "small"; // 'small', 'medium', 'large'
  export let viewMode = "grid"; // 'list' or 'grid'

  function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
  }

  function goToEdit() {
    const url = new URL(window.location);
    url.searchParams.set("mode", "edit");
    window.location.href = url.toString();
  }

  function goToVote() {
    window.location.href = `/vote.html?listName=${encodeURIComponent(listName)}`;
  }

  function toggleViewMode() {
    viewMode = viewMode === "list" ? "grid" : "list";
  }

  function setViewSize(size) {
    viewSize = size;
  }

  // Selected item chart
  let selectedItem = null;
  let selectedIndex = null;
  let eloHistory = [];

  async function handleSelect(event) {
    const { item, index } = event.detail;
    // Toggle off if same item clicked again
    if (selectedItem?.name === item.name) {
      selectedItem = null;
      selectedIndex = null;
      eloHistory = [];
      return;
    }
    selectedItem = item;
    selectedIndex = index;
    eloHistory = [];
    try {
      const result = await getEloHistory(listName, item.name);
      eloHistory = result.history || [];
    } catch (e) {
      eloHistory = [];
    }
  }
</script>

<div class="view-container">
  <!-- List Info Row -->
  <div class="list-info-row">
    <div class="col-title">TITLE</div>
    <div class="col-list-descrip">DESCRIP</div>
    <div class="col-votes">VOTES</div>
    <div class="col-last-voted">LAST VOTED</div>
    <div class="col-fix">FIX</div>
    <div class="col-act">ACT</div>
  </div>

  <div class="list-info-data">
    <div class="col-title content-text">{listName}</div>
    <div class="col-list-descrip content-text">{listInfo.description || ""}</div>
    <div class="col-votes faded">{listInfo.voteCount || 0}</div>
    <div class="col-last-voted faded">{formatDate(listInfo.lastVoteTimestamp)}</div>
    <div class="col-fix">
      <button class="action-button" on:click={goToEdit}>EDIT</button>
    </div>
    <div class="col-act">
      <button class="action-button" on:click={goToVote}>VOTE</button>
    </div>
  </div>

  <!-- Selected Item Chart Row -->
  <EloChart item={selectedItem} index={selectedIndex} history={eloHistory} />

  <!-- Controls Row -->
  <div class="button-row">
    <div class="button-cell">
      <button class="action-button" on:click={toggleViewMode}>
        {viewMode === "list" ? "GRID" : "LIST"}
      </button>
    </div>
    <div class="button-cell">
      <button
        class="action-button {viewSize === 'small' ? 'active' : ''}"
        on:click={() => setViewSize('small')}
      >
        S
      </button>
    </div>
    <div class="button-cell">
      <button
        class="action-button {viewSize === 'medium' ? 'active' : ''}"
        on:click={() => setViewSize('medium')}
      >
        M
      </button>
    </div>
    <div class="button-cell">
      <button
        class="action-button {viewSize === 'large' ? 'active' : ''}"
        on:click={() => setViewSize('large')}
      >
        L
      </button>
    </div>
  </div>

  <!-- View Content -->
  {#if viewMode === "list"}
    <List {items} {viewSize} />
  {:else}
    <Grid {items} {viewSize} on:select={handleSelect} />
  {/if}
</div>

<style>
  .view-container {
    background-color: var(--color-white);
    width: 100%;
    margin: 0;
    padding: 0;
  }

  /* List Info Row */
  .list-info-row,
  .list-info-data {
    display: flex;
    width: 100%;
    height: var(--cell-height);
    border-bottom: var(--border);
  }

  .list-info-row > div,
  .list-info-data > div {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    border-right: var(--border);
    padding: var(--spacing-sm);
    font-family: var(--font-family);
    box-sizing: border-box;
  }

  .list-info-row > div:last-child,
  .list-info-data > div:last-child {
    border-right: none;
  }

  .list-info-row > div {
    font-size: var(--font-size-header);
    color: var(--color-text-primary);
  }

  .list-info-data .col-title {
    justify-content: center;
    overflow: hidden;
    white-space: nowrap;
  }

  .list-info-data .col-list-descrip {
    justify-content: flex-start;
    overflow: hidden;
    white-space: nowrap;
  }

  .col-title {
    flex: 1;
    min-width: 0;
  }

  .col-list-descrip {
    width: 251px;
    flex-shrink: 0;
  }

  .col-votes {
    width: 74px;
    flex-shrink: 0;
    padding: 0 var(--spacing-sm);
  }

  .col-last-voted {
    width: 103px;
    flex-shrink: 0;
    padding: 0 var(--spacing-sm);
  }

  .list-info-data .col-votes,
  .list-info-data .col-last-voted {
    font-size: var(--font-size-header);
  }

  .col-fix,
  .col-act {
    width: 66px;
    flex-shrink: 0;
    padding: 3px;
  }

  .action-button {
    border: var(--border-button);
    border-radius: var(--border-radius-button);
    background-color: var(--color-white);
    font-family: var(--font-family);
    font-size: var(--font-size-content);
    color: var(--color-text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    box-sizing: border-box;
    text-transform: uppercase;
    width: 100%;
    height: var(--button-height);
  }

  .action-button:hover {
    opacity: 0.8;
  }

  .action-button.active {
    background-color: var(--color-black);
    color: var(--color-white);
  }

  /* Button Row */
  .button-row {
    display: flex;
    width: 100%;
    height: var(--cell-height);
    border-bottom: var(--border);
  }

  .button-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    border-right: var(--border);
    padding: 3px;
    box-sizing: border-box;
  }

  .button-cell:last-child {
    border-right: none;
  }

  .content-text {
    font-size: var(--font-size-content);
    color: var(--color-text-primary);
  }

  .faded {
    font-size: var(--font-size-content);
    color: var(--color-text-faded);
  }
</style>
