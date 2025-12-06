<script>
  import { onMount, onDestroy } from "svelte";
  import { getPairForVoting, vote, getListInfo } from "../lib/api.js";

  export let listName = "";

  // Get listName from URL if not provided as prop
  if (!listName) {
    const searchParams = new URLSearchParams(window.location.search);
    listName = searchParams.get("listName") || "";
  }
  let loading = true;
  let error = null;
  let pairData = null;
  let listInfo = {};
  let voting = false;

  // Session tracking
  let sessionStartTime = Date.now();
  let currentTime = Date.now();
  let sessionVoteCount = 0;
  let timeInterval;

  async function loadVotingPair() {
    if (!listName) {
      error = "No list name provided";
      loading = false;
      return;
    }

    try {
      loading = true;
      error = null;

      // Load pair data and list info in parallel
      const [pair, info] = await Promise.all([getPairForVoting(listName), getListInfo(listName)]);

      pairData = pair;
      listInfo = info;
    } catch (err) {
      console.error("Error loading voting pair:", err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleVoteWithAnimation(winner, loser) {
    if (voting) return; // Prevent double voting

    try {
      voting = true;
      // Proceed with actual vote and load next pair
      await handleVote(winner, loser);
    } catch (err) {
      console.error("Error in vote:", err);
      error = "Failed to submit vote. Please try again.";
      voting = false;
    }
  }

  async function handleVote(winner, loser) {
    try {
      // Calculate current session time in milliseconds
      const currentSessionTime = currentTime - sessionStartTime;
      await vote(listName, winner.name, loser.name, currentSessionTime);

      // Increment session vote count
      sessionVoteCount++;

      // Load new pair after successful vote
      await loadVotingPair();
    } catch (err) {
      console.error("Error voting:", err);
      error = "Failed to submit vote. Please try again.";
      throw err; // Re-throw to be handled by handleVoteWithAnimation
    } finally {
      voting = false;
    }
  }

  function handleVoteForItem1(event) {
    handleVoteWithAnimation(pairData.item1, pairData.item2);
  }

  function handleVoteForItem2(event) {
    handleVoteWithAnimation(pairData.item2, pairData.item1);
  }

  function skipVote() {
    loadVotingPair(); // Just load a new pair
  }

  function goToResults() {
    window.location.href = `/grid.html?listName=${encodeURIComponent(listName)}`;
  }

  // Handle keyboard navigation
  function handleKeydown(event) {
    if (loading || voting || !pairData) return;

    if (event.key === "ArrowLeft" || event.key === "1") {
      handleVoteWithAnimation(pairData.item1, pairData.item2);
    } else if (event.key === "ArrowRight" || event.key === "2") {
      handleVoteWithAnimation(pairData.item2, pairData.item1);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      skipVote();
    }
  }

  // Session timer functions
  function formatElapsedTime(startTime, currentTime) {
    const elapsedMs = currentTime - startTime;
    const seconds = Math.floor(elapsedMs / 1000) % 60;
    const minutes = Math.floor(elapsedMs / (1000 * 60));

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function startSessionTimer() {
    timeInterval = setInterval(() => {
      currentTime = Date.now();
    }, 1000);
  }

  function stopSessionTimer() {
    if (timeInterval) {
      clearInterval(timeInterval);
    }
  }

  // Parse item data
  function parseItemData(item) {
    if (!item?.data) return null;
    return typeof item.data === "string" ? JSON.parse(item.data) : item.data;
  }

  // Sync description heights on desktop
  let descRow1;
  let descRow2;

  function syncDescriptionHeights() {
    if (!descRow1 || !descRow2) return;
    if (window.innerWidth <= 740) {
      // Reset heights on mobile
      descRow1.style.height = 'auto';
      descRow2.style.height = 'auto';
      return;
    }

    // Reset heights first
    descRow1.style.height = 'auto';
    descRow2.style.height = 'auto';

    // Get natural heights
    const height1 = descRow1.offsetHeight;
    const height2 = descRow2.offsetHeight;
    const maxHeight = Math.max(height1, height2);

    // Apply max height to both
    descRow1.style.height = `${maxHeight}px`;
    descRow2.style.height = `${maxHeight}px`;
  }

  $: if (pairData && !loading) {
    setTimeout(syncDescriptionHeights, 0);
  }

  onMount(() => {
    loadVotingPair();
    startSessionTimer();
    window.addEventListener('resize', syncDescriptionHeights);
  });

  onDestroy(() => {
    stopSessionTimer();
    window.removeEventListener('resize', syncDescriptionHeights);
  });
</script>

<svelte:head>
  <title>Vote - {listName}</title>
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

<div class="vote-container">
  <!-- Title Row -->
  <div class="header-cell">
    <a href="/">ELO CHAMBER</a>
  </div>

  <!-- Info Rows Wrapper (for mobile scrolling) -->
  <div class="info-wrapper">
    <!-- List Info Row -->
    <div class="list-info-row">
      <div class="col-title">TITLE</div>
      <div class="col-prompt">PROMPT</div>
      <div class="col-time">TIME</div>
      <div class="col-votes">VOTES</div>
    </div>

    <div class="list-info-data">
      <div class="col-title content-text">{listName}</div>
      <div class="col-prompt content-text">{listInfo.prompt || ""}</div>
      <div class="col-time faded">{formatElapsedTime(sessionStartTime, currentTime)}</div>
      <div class="col-votes faded">{sessionVoteCount}</div>
    </div>
  </div>

  <!-- Controls Row -->
  <div class="button-row">
    <div class="button-cell">
      <button class="action-button" on:click={skipVote} disabled={voting}>SKIP</button>
    </div>
    <div class="button-cell">
      <button class="action-button" on:click={goToResults}>RESULTS</button>
    </div>
  </div>

  <!-- Voting Area -->
  {#if loading}
    <div class="voting-area">
      <div class="loading-message">Loading voting pair...</div>
    </div>
  {:else if error}
    <div class="voting-area">
      <div class="error-message">Error: {error}</div>
    </div>
  {:else if pairData && pairData.item1 && pairData.item2}
    <div class="voting-area">
      <div class="desktop-layout">
        <!-- Item 1 -->
        <div class="vote-column">
          <div class="vote-row item-image">
            {#if parseItemData(pairData.item1)?.picture}
              <img src={parseItemData(pairData.item1).picture} alt={pairData.item1.name} />
            {/if}
          </div>
          <div class="vote-row item-name">{pairData.item1.name}</div>
          {#if parseItemData(pairData.item1)?.description}
            <div class="vote-row item-description" bind:this={descRow1}>{parseItemData(pairData.item1).description}</div>
          {:else}
            <div class="vote-row item-description" bind:this={descRow1}></div>
          {/if}
          <div class="vote-row button-row-container">
            <button class="action-button" on:click={handleVoteForItem1} disabled={voting}>
              VOTE
            </button>
          </div>
        </div>

        <!-- Item 2 -->
        <div class="vote-column">
          <div class="vote-row item-image">
            {#if parseItemData(pairData.item2)?.picture}
              <img src={parseItemData(pairData.item2).picture} alt={pairData.item2.name} />
            {/if}
          </div>
          <div class="vote-row item-name">{pairData.item2.name}</div>
          {#if parseItemData(pairData.item2)?.description}
            <div class="vote-row item-description" bind:this={descRow2}>{parseItemData(pairData.item2).description}</div>
          {:else}
            <div class="vote-row item-description" bind:this={descRow2}></div>
          {/if}
          <div class="vote-row button-row-container">
            <button class="action-button" on:click={handleVoteForItem2} disabled={voting}>
              VOTE
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Layout -->
      <div class="mobile-layout">
        <!-- Item 1 Name -->
        <div class="vote-row item-name">{pairData.item1.name}</div>
        <!-- Item 1 Image -->
        <div class="vote-row item-image">
          {#if parseItemData(pairData.item1)?.picture}
            <img src={parseItemData(pairData.item1).picture} alt={pairData.item1.name} />
          {/if}
        </div>
        <!-- Item 1 Description -->
        {#if parseItemData(pairData.item1)?.description}
          <div class="vote-row item-description">{parseItemData(pairData.item1).description}</div>
        {/if}

        <!-- Item 2 Name -->
        <div class="vote-row item-name">{pairData.item2.name}</div>
        <!-- Item 2 Image -->
        <div class="vote-row item-image">
          {#if parseItemData(pairData.item2)?.picture}
            <img src={parseItemData(pairData.item2).picture} alt={pairData.item2.name} />
          {/if}
        </div>
        <!-- Item 2 Description -->
        {#if parseItemData(pairData.item2)?.description}
          <div class="vote-row item-description">{parseItemData(pairData.item2).description}</div>
        {/if}

        <!-- Vote Buttons at Bottom -->
        <div class="vote-row button-row-container">
          <button class="action-button" on:click={handleVoteForItem1} disabled={voting}>
            VOTE
          </button>
        </div>
        <div class="vote-row button-row-container">
          <button class="action-button" on:click={handleVoteForItem2} disabled={voting}>
            VOTE
          </button>
        </div>
      </div>
    </div>
  {:else}
    <div class="voting-area">
      <div class="no-pairs">
        <p>No pairs available for voting. The list might be empty or have only one item.</p>
        <button class="action-button" on:click={goToResults}>VIEW RESULTS</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .vote-container {
    background-color: var(--color-white);
    width: 100%;
    height: 100vh;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
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

  .header-cell a {
    font-family: var(--font-family);
    font-size: var(--font-size-header);
    color: var(--color-text-primary);
    text-decoration: none;
  }

  .header-cell a:hover {
    text-decoration: underline;
  }

  /* Info Wrapper */
  .info-wrapper {
    width: 100%;
    overflow-x: visible;
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

  .list-info-data .col-title,
  .list-info-data .col-prompt {
    justify-content: center;
    overflow: hidden;
    white-space: nowrap;
  }

  .col-title {
    width: 280px;
    flex-shrink: 0;
  }

  .col-prompt {
    flex: 1;
    min-width: 0;
  }

  .col-time,
  .col-votes {
    width: 74px;
    flex-shrink: 0;
  }

  .list-info-data .col-time,
  .list-info-data .col-votes {
    font-size: var(--font-size-header);
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

  /* Voting Area */
  .voting-area {
    flex: 1;
    display: flex;
    width: 100%;
    border-bottom: var(--border);
    min-height: 0;
    overflow: hidden;
  }

  .desktop-layout {
    display: flex;
    width: 100%;
  }

  .mobile-layout {
    display: none;
  }

  .vote-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-right: var(--border);
    box-sizing: border-box;
    overflow-y: auto;
  }

  .vote-column:last-child {
    border-right: none;
  }

  /* Mobile Responsive */
  @media (max-width: 740px) {
    /* Title row takes full viewport width */
    .header-cell {
      width: 100vw;
    }

    /* Info wrapper allows horizontal scrolling */
    .info-wrapper {
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .info-wrapper::-webkit-scrollbar {
      display: none;
    }

    /* Frozen columns on the right */
    .list-info-row .col-time,
    .list-info-row .col-votes,
    .list-info-data .col-time,
    .list-info-data .col-votes {
      position: sticky;
      background-color: var(--color-white);
      z-index: 1;
    }

    .list-info-row .col-time,
    .list-info-data .col-time {
      right: 74px;
    }

    .list-info-row .col-votes,
    .list-info-data .col-votes {
      right: 0;
    }

    .desktop-layout {
      display: none;
    }

    .mobile-layout {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      overflow-y: auto;
      min-height: 0;
    }

    .col-prompt {
      width: 200px;
      min-width: 100px;
      border-right: unset !important;
    }

    .list-info-row .col-time,
    .list-info-data .col-time {
      border-left: var(--border);
    }

    .list-info-data .col-prompt {
      justify-content: flex-start;
    }
    .list-info-data,
    .list-info-row {
      width: fit-content;
    }
  }

  .vote-row {
    width: 100%;
    border-bottom: var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-sm);
    box-sizing: border-box;
    min-height: var(--cell-height);
  }

  .vote-row:last-child {
    border-bottom: none;
  }

  .vote-row.item-name {
    height: var(--cell-height);
    justify-content: center;
  }

  .vote-row.item-image {
    min-height: 0;
    height: auto;
    /* padding: 0; */
  }

  .vote-row.item-description {
    min-height: var(--cell-height);
    height: auto;
  }

  .vote-row.button-row-container {
    height: var(--cell-height);
    justify-content: center;
  }

  .item-image {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: var(--spacing-sm);
  }

  .item-image img {
    width: 100%;
    height: 100%;
    aspect-ratio: 1 / 1;
    object-fit: contain;
  }

  .item-name {
    font-family: var(--font-family);
    font-size: var(--font-size-content);
    color: var(--color-text-primary);
    text-align: center;
  }

  .item-description {
    font-family: var(--font-family);
    font-size: var(--font-size-content);
    color: var(--color-text-primary);
    text-align: left;
    width: 100%;
    flex-shrink: 0;
  }

  .vote-button {
    border: var(--border-button);
    border-radius: var(--border-radius-button);
    background-color: var(--color-white);
    font-family: var(--font-family);
    /* font-size: var(--font-size-content); */
    color: var(--color-text-primary);
    cursor: pointer;
    /* text-transform: uppercase; */
    width: 100%;
    height: var(--button-height);
  }

  .vote-button:hover:not(:disabled) {
    opacity: 0.8;
  }

  .vote-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .content-text {
    font-size: var(--font-size-content);
    color: var(--color-text-primary);
  }

  .faded {
    font-size: var(--font-size-content);
    color: var(--color-text-faded);
  }

  .loading-message,
  .error-message,
  .no-pairs {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    width: 100%;
    padding: var(--spacing-md);
    text-align: center;
  }

  .error-message {
    color: red;
  }
  @media (max-width: 740px) {
    .content-text {
      font-size: var(--font-size-content-mobile);
    }
    .item-description {
      font-size: var(--font-size-content-mobile);
      align-items: flex-start;
      min-height: var(--cell-height);
      height: auto;
      flex-shrink: 0;
    }
  }
</style>
