<script>
  import { onMount, onDestroy } from "svelte";
  import { getPairForVoting, vote, getListInfo } from "../../lib/api.js";

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

  // Accent color from list metadata
  let accentColor = "#ffff00";

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  function luminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  $: accentRgb = hexToRgb(accentColor);
  $: labelTextColor = luminance(accentColor) < 0.5 ? '#ffffff' : 'var(--color-text-primary)';

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
      accentColor = info?.accentColor || "#ffff00";
    } catch (err) {
      console.error("Error loading voting pair:", err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // Click animation state
  let animatingItem = 0; // 0 = none, 1 = item1, 2 = item2
  let exclamationCount = 0;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function easeIn(t) {
    return t * t;
  }

  async function playVoteAnimation(itemNumber) {
    animatingItem = itemNumber;

    const duration = 200;
    const startFill = itemNumber === 1 ? item1Fill : item2Fill;
    const startTime = performance.now();

    return new Promise(resolve => {
      let lastExclamation = 0;

      function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const eased = easeIn(progress);
        const fill = startFill + (100 - startFill) * eased;

        if (itemNumber === 1) {
          item1Fill = fill;
        } else {
          item2Fill = fill;
        }

        // Step exclamation marks at even intervals
        const exclamationStep = Math.min(5, Math.floor(progress * 5) + 1);
        if (exclamationStep !== lastExclamation) {
          exclamationCount = exclamationStep;
          lastExclamation = exclamationStep;
        }

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          exclamationCount = 5;
          resolve();
        }
      }

      requestAnimationFrame(tick);
    });
  }

  async function handleVoteWithAnimation(winner, loser) {
    if (voting) return; // Prevent double voting

    try {
      voting = true;

      // Determine which item was voted for
      const itemNumber = winner === pairData.item1 ? 1 : 2;

      // Play animation and wait for it to finish
      await playVoteAnimation(itemNumber);
      await sleep(200);

      // Proceed with actual vote and load next pair
      await handleVote(winner, loser);

      // Reset animation state and recalculate fill from cursor position
      animatingItem = 0;
      exclamationCount = 0;
      if (isHoveringVotingArea) {
        updateFillFromMouseX(lastMouseX);
      } else {
        item1Fill = 0;
        item2Fill = 0;
      }
    } catch (err) {
      console.error("Error in vote:", err);
      error = "Failed to submit vote. Please try again.";
      voting = false;
      animatingItem = 0;
      exclamationCount = 0;
      if (isHoveringVotingArea) {
        updateFillFromMouseX(lastMouseX);
      } else {
        item1Fill = 0;
        item2Fill = 0;
      }
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

  // Gradient hover effect based on cursor position
  let item1Fill = 0;
  let item2Fill = 0;
  let isHoveringVotingArea = false;
  let lastMouseX = 0;

  function updateFillFromMouseX(mouseX) {
    const vw = window.innerWidth;
    const midpoint = vw / 2;
    // Max 10% fill on hover — full fill only on click animation
    const maxHoverFill = 10;

    if (mouseX <= midpoint) {
      item1Fill = Math.min(maxHoverFill, Math.max(0, (1 - mouseX / midpoint) * maxHoverFill));
      item2Fill = 0;
    } else {
      item2Fill = Math.min(maxHoverFill, Math.max(0, (1 - (vw - mouseX) / midpoint) * maxHoverFill));
      item1Fill = 0;
    }
  }

  function handleVotingAreaMouseMove(event) {
    if (animatingItem) return; // Don't update during animation
    lastMouseX = event.clientX;
    updateFillFromMouseX(lastMouseX);
    isHoveringVotingArea = true;
  }

  function handleVotingAreaMouseLeave() {
    item1Fill = 0;
    item2Fill = 0;
    isHoveringVotingArea = false;
  }

  $: item1Gradient = item1Fill > 0
    ? `linear-gradient(270deg, rgba(${accentRgb},1) ${item1Fill}%, transparent ${item1Fill}%)`
    : 'none';

  $: item2Gradient = item2Fill > 0
    ? `linear-gradient(90deg, rgba(${accentRgb},1) ${item2Fill}%, transparent ${item2Fill}%)`
    : 'none';

  // Animated label text with exclamation marks
  $: item1LabelText = pairData?.item1
    ? (animatingItem === 1 ? '!'.repeat(exclamationCount) + pairData.item1.name + '!'.repeat(exclamationCount) : pairData.item1.name)
    : '';
  $: item2LabelText = pairData?.item2
    ? (animatingItem === 2 ? '!'.repeat(exclamationCount) + pairData.item2.name + '!'.repeat(exclamationCount) : pairData.item2.name)
    : '';

  onMount(() => {
    loadVotingPair();
    startSessionTimer();
  });

  onDestroy(() => {
    stopSessionTimer();
  });
</script>

<svelte:head>
  <title>Vote - {listName}</title>
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

<div class="vote-container">
  <!-- Info Rows Wrapper -->
  <div class="info-wrapper">
    <!-- List Info Header Row -->
    <div class="list-info-row">
      <div class="col-votes">VOTES</div>
      <div class="col-title">TITLE</div>
      <div class="col-prompt">PROMPT</div>
      <div class="col-time">TIME</div>
    </div>

    <!-- List Info Data Row -->
    <div class="list-info-data">
      <div class="col-votes faded">{sessionVoteCount}</div>
      <div class="col-title content-text">{listName}</div>
      <div class="col-prompt content-text">{listInfo.prompt || ""}</div>
      <div class="col-time faded">{formatElapsedTime(sessionStartTime, currentTime)}</div>
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
    <div class="voting-area" on:mousemove={handleVotingAreaMouseMove} on:mouseleave={handleVotingAreaMouseLeave}>
      <div class="desktop-layout">
        <!-- Item 1 -->
        <div class="vote-column">
          <div class="vote-row item-image-area" on:click={handleVoteForItem1}>
            <div class="badge item-label" style="background: {accentColor}; color: {labelTextColor};">{item1LabelText}</div>
            <div class="image-button" style="background-image: {item1Gradient};">
              {#if parseItemData(pairData.item1)?.picture}
                <img src={parseItemData(pairData.item1).picture} alt={pairData.item1.name} />
              {/if}
            </div>
            {#if parseItemData(pairData.item1)?.description}
              <div class="badge item-description-label">{parseItemData(pairData.item1).description}</div>
            {/if}
          </div>
        </div>

        <!-- Item 2 -->
        <div class="vote-column">
          <div class="vote-row item-image-area" on:click={handleVoteForItem2}>
            <div class="badge item-label" style="background: {accentColor}; color: {labelTextColor};">{item2LabelText}</div>
            <div class="image-button" style="background-image: {item2Gradient};">
              {#if parseItemData(pairData.item2)?.picture}
                <img src={parseItemData(pairData.item2).picture} alt={pairData.item2.name} />
              {/if}
            </div>
            {#if parseItemData(pairData.item2)?.description}
              <div class="badge item-description-label">{parseItemData(pairData.item2).description}</div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Mobile Layout -->
      <div class="mobile-layout">
        <!-- Item 1 -->
        <div class="vote-row item-image-area" on:click={handleVoteForItem1}>
          <div class="badge item-label" style="background: {accentColor}; color: {labelTextColor};">{item1LabelText}</div>
          <div class="image-button" style="background-image: {item1Gradient};">
            {#if parseItemData(pairData.item1)?.picture}
              <img src={parseItemData(pairData.item1).picture} alt={pairData.item1.name} />
            {/if}
          </div>
          {#if parseItemData(pairData.item1)?.description}
            <div class="badge item-description-label">{parseItemData(pairData.item1).description}</div>
          {/if}
        </div>

        <!-- Item 2 -->
        <div class="vote-row item-image-area" on:click={handleVoteForItem2}>
          <div class="badge item-label" style="background: {accentColor}; color: {labelTextColor};">{item2LabelText}</div>
          <div class="image-button" style="background-image: {item2Gradient};">
            {#if parseItemData(pairData.item2)?.picture}
              <img src={parseItemData(pairData.item2).picture} alt={pairData.item2.name} />
            {/if}
          </div>
          {#if parseItemData(pairData.item2)?.description}
            <div class="badge item-description-label">{parseItemData(pairData.item2).description}</div>
          {/if}
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

  <!-- Instructions Row -->
  <div class="instructions-row">
    CLICK OR USE ARROW KEYS TO VOTE. 'S' TO SKIP. 'ENTER' TO VIEW RESULTS.
  </div>

  <!-- Skip/Results Bar -->
  <div class="bottom-bar">
    <div class="bottom-button-cell">
      <button class="action-button" on:click={skipVote} disabled={voting}>SKIP</button>
    </div>
    <div class="bottom-button-cell">
      <button class="action-button" on:click={goToResults}>RESULTS</button>
    </div>
  </div>
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

  .col-votes,
  .col-time {
    width: 74px;
    flex-shrink: 0;
  }

  .col-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .col-prompt {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  /* Voting Area */
  .voting-area {
    flex: 1;
    display: flex;
    width: 100%;
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

  .vote-row {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-sm);
    box-sizing: border-box;
  }

  /* Image area - takes up remaining space */
  .vote-row.item-image-area {
    flex: 1;
    justify-content: center;
    align-items: center;
    gap: 10px;
    min-height: 0;
    overflow: clip;
    cursor: pointer;
  }

  /* Image button */
  .image-button {
    border: var(--border-button);
    border-radius: var(--border-radius-button);
    background: var(--color-white);
    padding: var(--spacing-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .item-image-area:hover .image-button:not(:disabled) {
    /* gradient hover handled dynamically via inline style */
  }


  .image-button img {
    width: 200px;
    height: 200px;
    object-fit: contain;
  }

  /* Item label with accent color highlight */
  .item-label {
    font-size: var(--font-size-content);
    text-align: center;
  }

  /* Description label with grey background */
  .item-description-label {
    background: #f1f1f1;
    text-align: justify;
    max-width: 210px;
  }



  /* Instructions Row */
  .instructions-row {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--cell-height);
    border-top: var(--border);
    border-bottom: var(--border);
    font-family: var(--font-family);
    font-size: var(--font-size-header);
    color: var(--color-text-primary);
    flex-shrink: 0;
  }

  /* Bottom Bar - Skip/Results */
  .bottom-bar {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    height: var(--cell-height);
    border-bottom: var(--border);
    flex-shrink: 0;
  }

  .bottom-button-cell {
    display: flex;
    align-items: center;
    padding: var(--spacing-xs);
    border: var(--border);
    box-sizing: border-box;
  }

  .action-button {
    height: var(--button-height);
    border: var(--border-button);
    border-radius: var(--border-radius-button);
    background: var(--color-white);
    padding: 0 var(--spacing-sm);
    font-family: var(--font-family);
    font-size: var(--font-size-content);
    cursor: pointer;
    white-space: nowrap;
  }

  .action-button:hover:not(:disabled) {
    background: var(--color-black);
    color: var(--color-white);
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .content-text {
    font-size: var(--font-size-content);
    color: var(--color-text-primary);
  }

  .faded {
    font-size: var(--font-size-header);
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

  /* Mobile Responsive */
  @media (max-width: 740px) {
    .info-wrapper {
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .info-wrapper::-webkit-scrollbar {
      display: none;
    }

    .list-info-row .col-time,
    .list-info-row .col-votes,
    .list-info-data .col-time,
    .list-info-data .col-votes {
      position: sticky;
      background-color: var(--color-white);
      z-index: 1;
    }

    .list-info-row .col-votes,
    .list-info-data .col-votes {
      left: 0;
    }

    .list-info-row .col-time,
    .list-info-data .col-time {
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

    .content-text {
      font-size: var(--font-size-content-mobile);
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

    .list-info-data .col-prompt,
    .list-info-data .col-title {
      justify-content: flex-start;
    }

    .list-info-data,
    .list-info-row {
      width: fit-content;
    }
  }
</style>
