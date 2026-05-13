<script>
  import { onMount, onDestroy } from "svelte";
  import Home from "./components/Home.svelte";
  import HomeV1 from "./components/v1/Home.svelte";
  import ListDetailView from "./components/ListDetailView.svelte";
  import VoteView from "./components/VoteView.svelte";
  import CreateView from "./components/CreateView.svelte";
  import { getStats, sendHeartbeat } from "./lib/api.js";

  // Simple routing based on URL params for now
  let currentView = "home";
  let listName = "";

  // Live stats
  let onlineUsers = 0;
  let votesLastHour = 0;
  let statsInterval;

  async function fetchStats() {
    try {
      const stats = await getStats();
      onlineUsers = stats.onlineUsers;
      votesLastHour = stats.votesLastHour;
    } catch (e) {
      // silently fail
    }
  }

  async function heartbeat() {
    try {
      await sendHeartbeat();
    } catch (e) {
      // silently fail
    }
  }

  function getViewFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (
      path.includes("grid.html") ||
      path.includes("list.html") ||
      (urlParams.has("view") &&
        (urlParams.get("view") === "grid" || urlParams.get("view") === "list"))
    ) {
      listName = urlParams.get("listName") || "";
      return "listdetail";
    } else if (
      path.includes("vote.html") ||
      (urlParams.has("view") && urlParams.get("view") === "vote")
    ) {
      listName = urlParams.get("listName") || "";
      return "vote";
    } else if (
      path.includes("create.html") ||
      (urlParams.has("view") && urlParams.get("view") === "create")
    ) {
      return "create";
    } else if (path.startsWith("/v1")) {
      return "home_v1";
    }
    return "home";
  }

  function updateView() {
    currentView = getViewFromURL();
  }

  onMount(() => {
    window.addEventListener("popstate", updateView);

    fetchStats();
    heartbeat();

    statsInterval = setInterval(() => {
      fetchStats();
      heartbeat();
    }, 30000);

    return () => {
      window.removeEventListener("popstate", updateView);
    };
  });

  onDestroy(() => {
    if (statsInterval) {
      clearInterval(statsInterval);
    }
  });

  currentView = getViewFromURL();
</script>

<main>
  <div class="app-container">
    <!-- Header -->
    <div class="header-cell">
      <span class="header-stat">{onlineUsers} online</span>
      <a href="/">This or That</a>
      <span class="header-stat">{votesLastHour} votes/hr</span>
    </div>

    {#if currentView === "home"}
      <Home />
    {:else if currentView === "home_v1"}
      <HomeV1 />
    {:else if currentView === "listdetail"}
      <ListDetailView {listName} />
    {:else if currentView === "vote"}
      <VoteView {listName} />
    {:else if currentView === "create"}
      <CreateView />
    {/if}
  </div>
</main>

<style>
  .header-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
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
    text-transform: uppercase;
  }

  .header-cell a:hover {
    text-decoration: underline;
  }

  .header-stat {
    font-family: var(--font-family);
    font-size: var(--font-size-header);
    color: var(--color-text-faded);
    position: absolute;
  }

  .header-stat:first-child {
    left: var(--spacing-sm);
  }

  .header-stat:last-child {
    right: var(--spacing-sm);
  }
</style>
