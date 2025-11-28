<script>
  import { onMount } from "svelte";
  import { getListsWithPopularity } from "../lib/api.js";

  let allLists = [];
  let displayedLists = [];
  let loading = true;
  let currentSort = "newest";
  let showSortDropdown = false;
  let displaySize = "small"; // "small", "medium", "large"

  // Bind widths from data cells to header cells
  let lookColWidth = 0;
  let actColWidth = 0;
  let lookColRef;
  let actColRef;

  $: if (lookColRef) {
    lookColWidth = lookColRef.getBoundingClientRect().width;
  }
  $: if (actColRef) {
    actColWidth = actColRef.getBoundingClientRect().width;
  }

  // Calculate pic width based on display size
  $: picColWidth = displaySize === "small" ? 35 : displaySize === "medium" ? 70 : 100;

  const sortOptions = {
    newest: "Newest",
    items: "Size",
    recent: "Recently Voted",
  };

  async function loadLists() {
    try {
      loading = true;
      const response = await getListsWithPopularity();
      allLists = response.lists || [];
      sortAndDisplayLists();
    } catch (error) {
      console.error("Error loading lists:", error);
    } finally {
      loading = false;
    }
  }

  function sortAndDisplayLists() {
    if (allLists.length === 0) return;

    const sortedLists = [...allLists];

    switch (currentSort) {
      case "newest":
        sortedLists.sort((a, b) => {
          if (!a.createdAt && !b.createdAt) return 0;
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        break;
      case "items":
        sortedLists.sort((a, b) => b.itemCount - a.itemCount);
        break;
      case "recent":
        sortedLists.sort((a, b) => {
          if (!a.lastVoteTimestamp && !b.lastVoteTimestamp) return 0;
          if (!a.lastVoteTimestamp) return 1;
          if (!b.lastVoteTimestamp) return -1;
          return new Date(b.lastVoteTimestamp) - new Date(a.lastVoteTimestamp);
        });
        break;
    }

    displayedLists = sortedLists;
  }

  function handleSortChange(sortType) {
    currentSort = sortType;
    showSortDropdown = false;
    sortAndDisplayLists();
  }

  function toggleSortDropdown() {
    showSortDropdown = !showSortDropdown;
  }

  function closeSortDropdown() {
    showSortDropdown = false;
  }

  function setDisplaySize(size) {
    displaySize = size;
  }

  function formatDate(dateString) {
    if (!dateString) return "01/2023";
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${year}`;
  }

  function formatLastVoted(timestamp) {
    if (!timestamp) return "0d";
    const lastVoteDate = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - lastVoteDate) / 1000);
    const diffInDays = Math.floor(diffInSeconds / 86400);
    return `${diffInDays}d`;
  }

  function getPreviewItems(list) {
    if (!list.itemsList) return "";
    const items = list.itemsList.split(", ");
    return items.join(", ");
  }

  function goToRandom() {
    if (displayedLists.length > 0) {
      const randomList = displayedLists[Math.floor(Math.random() * displayedLists.length)];
      window.location.href = `/vote.html?listName=${encodeURIComponent(randomList.name)}`;
    }
  }

  onMount(() => {
    loadLists();
  });
</script>

<svelte:window on:click={closeSortDropdown} />

<div class="home-container">
  <!-- Header -->
  <div class="header-cell">
    <p>ELO CHAMBER</p>
  </div>

  <!-- Action Buttons Row -->
  <div class="button-row">
    <div class="button-cell">
      <button class="action-button" on:click={() => (window.location.href = "/create.html")}>
        CREATE LIST
      </button>
    </div>
    <div class="button-cell">
      <button class="action-button" on:click={goToRandom}> RANDOM </button>
    </div>
    <div class="button-cell">
      <button class="action-button" on:click|stopPropagation={toggleSortDropdown}>
        {sortOptions[currentSort]}
      </button>
    </div>
    {#if showSortDropdown}
      {#each Object.entries(sortOptions) as [key, label]}
        {#if key !== currentSort}
          <div class="button-cell">
            <button class="action-button sort-option" on:click={() => handleSortChange(key)}>
              {label}
            </button>
          </div>
        {/if}
      {/each}
    {/if}
    <div class="button-cell">
      <button
        class="action-button {displaySize === 'small' ? 'active' : ''}"
        on:click={() => setDisplaySize("small")}
      >
        S
      </button>
    </div>
    <div class="button-cell">
      <button
        class="action-button {displaySize === 'medium' ? 'active' : ''}"
        on:click={() => setDisplaySize("medium")}
      >
        M
      </button>
    </div>
    <div class="button-cell">
      <button
        class="action-button {displaySize === 'large' ? 'active' : ''}"
        on:click={() => setDisplaySize("large")}
      >
        L
      </button>
    </div>
  </div>

  <!-- Table Header Row -->
  <div class="table-header">
    <div class="col-date header-date">DATE</div>
    <div
      class="col-pic-image header-pic"
      style="width: {picColWidth ? `${picColWidth}px` : 'auto'}"
    >
      PIC
    </div>
    <div class="col-title">TITLE</div>
    <div class="col-len">
      <div class="rotated-text">LEN</div>
    </div>
    <div class="col-descrip">DESCRIP</div>
    <div class="col-preview">PREVIEW</div>
    <div class="col-look" style="width: {lookColWidth ? `${lookColWidth}px` : 'auto'}">LOOK</div>
    <div class="col-act" style="width: {actColWidth ? `${actColWidth}px` : 'auto'}">ACT</div>
  </div>

  <!-- Table Body -->
  {#if loading}
    <div class="table-row">
      <div class="loading-cell">Loading lists...</div>
    </div>
  {:else if displayedLists.length === 0}
    <div class="table-row">
      <div class="loading-cell">No lists found</div>
    </div>
  {:else}
    {#each displayedLists as list}
      <div class="table-row size-{displaySize}">
        <div class="col-date faded">{formatDate(list.createdAt)}</div>
        <div class="col-last-voted faded">{formatLastVoted(list.lastVoteTimestamp)}</div>
        <div class="col-pic-image">
          {#if list.previewImage}
            <img src={list.previewImage} alt="" />
          {/if}
        </div>
        <div class="col-title content-text">{list.name}</div>
        <div class="col-len content-text">{list.itemCount || 0}</div>
        <div class="col-descrip faded">{list.description || ""}</div>
        <div class="col-preview faded">{getPreviewItems(list)}</div>
        <div class="col-look" bind:this={lookColRef}>
          <button
            class="action-button"
            on:click={() =>
              (window.location.href = `/grid.html?listName=${encodeURIComponent(list.name)}`)}
          >
            VIEW
          </button>
        </div>
        <div class="col-act" bind:this={actColRef}>
          <button
            class="action-button"
            on:click={() =>
              (window.location.href = `/vote.html?listName=${encodeURIComponent(list.name)}`)}
          >
            VOTE
          </button>
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .home-container {
    background-color: var(--color-white);
    width: 100%;
    min-height: 100vh;
    margin: 0;
    padding: 0;
  }

  /* Header */
  .header-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--cell-height);
    border-bottom: var(--border);
    padding: 0 var(--spacing-sm);
    box-sizing: border-box;
  }

  .header-cell p {
    font-family: var(--font-family);
    font-size: var(--font-size-header);
    color: var(--color-text-primary);
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

  .action-button {
    border: var(--border-button);
    border-radius: var(--border-radius-button);
    background-color: var(--color-white);
    /* padding: var(--spacing-sm); */
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
  }

  .action-button:hover {
    opacity: 0.8;
  }

  /* Table Header */
  .table-header {
    display: flex;
    width: 100%;
    border-bottom: var(--border);
  }

  .table-header > div {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--cell-height);
    border-right: var(--border);
    padding: var(--spacing-sm) 0;
    font-family: var(--font-family);
    font-size: var(--font-size-header);
    color: var(--color-text-primary);
    box-sizing: border-box;
  }

  .table-header > div:last-child {
    border-right: none;
  }

  .col-date {
    width: 68px;
    flex-shrink: 0;
  }

  /* Header DATE spans both date and time columns */
  .header-date {
    width: calc(68px + 35px);
  }

  .col-last-voted {
    width: 35px;
    flex-shrink: 0;
    padding: var(--spacing-sm);
  }

  .col-pic-image {
    width: 35px;
    height: var(--cell-height);
    flex-shrink: 0;
    border-right: var(--border);
    margin-right: -1px;
    padding: var(--spacing-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }

  /* Size variations for pic column */
  .size-medium .col-pic-image {
    width: 70px;
  }

  .size-large .col-pic-image {
    width: 100px;
  }

  /* Header PIC width is dynamically bound */
  .header-pic {
    height: var(--cell-height);
  }

  .col-pic-image img {
    width: 25px;
    height: 25px;
    object-fit: cover;
  }

  /* Image size variations */
  .size-medium .col-pic-image img {
    width: 60px;
    height: 60px;
  }

  .size-large .col-pic-image img {
    width: 90px;
    height: 90px;
  }

  .col-title {
    width: 172px;
    flex-shrink: 0;
    padding: var(--spacing-xs);
  }

  .col-len {
    width: 11px;
    flex-shrink: 0;
    position: relative;
  }

  .rotated-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(90deg);
    white-space: nowrap;
  }

  .col-descrip {
    width: 600px;
    flex-shrink: 0;
  }

  .col-preview {
    flex: 1;
    min-width: 0;
    padding: 0 var(--spacing-md);
  }

  .col-look,
  .col-act {
    /* width: 66px; */
    flex-shrink: 0;
    padding: 3px var(--spacing-xs);
  }

  /* Table Rows */
  .table-row {
    display: flex;
    width: 100%;
    border-bottom: var(--border);
  }

  /* Dynamic row heights based on display size */
  .table-row.size-small {
    height: 35px;
  }

  .table-row.size-medium {
    height: 70px;
  }

  .table-row.size-large {
    height: 100px;
  }

  .table-row > div {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    border-right: var(--border);
    font-family: var(--font-family);
    box-sizing: border-box;
  }

  .table-row > div:last-child {
    border-right: none;
  }

  .table-row .col-date,
  .table-row .col-last-voted {
    padding: 0 var(--spacing-sm);
  }

  .table-row .col-title,
  .table-row .col-len,
  .table-row .col-descrip {
    padding: var(--spacing-xs);
  }

  .table-row .col-title,
  .table-row .col-descrip {
    justify-content: flex-start;
    overflow: hidden;
    white-space: nowrap;
  }

  .table-row .col-preview {
    padding: 0 var(--spacing-md);
    overflow: hidden;
    white-space: nowrap;
    justify-content: flex-start;
  }

  .table-row .col-look,
  .table-row .col-act {
    padding: 3px;
  }

  .content-text {
    font-size: var(--font-size-content);
    color: var(--color-text-primary);
  }

  .faded {
    font-size: var(--font-size-content);
    color: var(--color-text-faded);
  }

  /* Date, time, and len columns use header font size */
  .table-row .col-date,
  .table-row .col-last-voted,
  .table-row .col-len {
    font-size: var(--font-size-header);
  }

  .sort-option {
    opacity: 0.6;
  }

  .sort-option:hover {
    opacity: 1;
  }

  .action-button.active {
    background-color: var(--color-black);
    color: var(--color-white);
  }

  .loading-cell {
    width: 100%;
    padding: var(--spacing-md);
    justify-content: center;
  }
</style>
