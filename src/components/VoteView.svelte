<script>
  import { onMount, onDestroy } from "svelte";
  import { getPairForVoting, vote, getListInfo } from "../lib/api.js";
  import VoteElement from "./VoteElement.svelte";

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
    const minutes = Math.floor(elapsedMs / (1000 * 60)) % 60;
    const hours = Math.floor(elapsedMs / (1000 * 60 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
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

<div class="vote-view-container">
  <!-- Header -->
  <div class="top-header">
    <a href="/" class="home-button">Elo Chamber</a>
  </div>

  <h1 class="index-title">{listName}</h1>
  <h2 class="instructions">Click Vote buttons or use arrow keys (1/2)</h2>

  <!-- Session Tracker -->

  {#if listInfo.prompt}
    <div class="listTop box">
      <p class="voteTitle">Prompt: {listInfo.prompt}</p>
    </div>
  {/if}
  <div class="actionButtons box">
    <div class="userSession">
      <div class="session-stat box">
        <span class="session-label"
          >Session time: {formatElapsedTime(sessionStartTime, currentTime)}</span
        >
      </div>
      <div class="session-stat box">
        <span class="session-label">Votes made: {sessionVoteCount}</span>
      </div>
    </div>

    <div class="actionButtons">
      <button class="clickable" on:click={skipVote} disabled={voting}>
        <p>skip</p>
      </button>

      <button class="clickable">
        <a href="/grid.html?listName={encodeURIComponent(listName)}"><p>results</p></a>
      </button>
    </div>
  </div>
  {#if loading}
    <div class="loading">Loading voting pair...</div>
  {:else if error}
    <div class="error">Error: {error}</div>
    <button class="clickable" on:click={loadVotingPair}>Try Again</button>
  {:else if pairData && pairData.item1 && pairData.item2}
    <div class="vote-wrapper box">
      <div class="elementVoteContainer">
        <!-- Item 1 -->
        <VoteElement item={pairData.item1} {voting} on:vote={handleVoteForItem1} />

        <!-- Item 2 -->
        <VoteElement item={pairData.item2} {voting} on:vote={handleVoteForItem2} />
      </div>
    </div>
  {:else}
    <div class="no-pairs">
      <p>No pairs available for voting. The list might be empty or have only one item.</p>
      <button class="clickable">
        <a href="/grid.html?listName={encodeURIComponent(listName)}">View Results</a>
      </button>
    </div>
  {/if}
</div>

<style>
  .vote-view-container {
    display: flex;
    flex-direction: column;
    margin: auto;
  }

  .top-header {
    padding: 1rem 0;
  }

  .home-button {
    font-size: 1.5rem;
    font-weight: bold;
    text-decoration: none;
    color: inherit;
  }

  .home-button:hover {
    text-decoration: underline;
  }

  .vote-wrapper {
    position: relative;
  }

  .index-title {
    text-align: center;
  }

  .instructions {
    text-align: center;
    color: #666;
  }

  .userSession {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 5p;
  }

  .session-stat {
    text-align: center;
    margin: 0;
  }

  .session-label {
    white-space: nowrap;
    opacity: 0.1;
  }
  .listTop {
    position: relative;
  }

  .actionButtons {
    display: flex;
    gap: 5px;
    justify-content: space-between;
  }
  .elementVoteContainer {
    display: flex;
    gap: 5px;
    align-items: center;
    /* margin-bottom: 10px; */
    justify-content: space-between;
  }

  .actionButtons {
    display: flex;
    gap: 5px;
    justify-content: space-between;
  }

  .loading,
  .error,
  .no-pairs {
    text-align: center;
  }

  .error {
    color: red;
  }
</style>
