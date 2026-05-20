<script>
  import { onMount, onDestroy } from "svelte";
  import Home from "./components/Home.svelte";
  import HomeV1 from "./components/v1/Home.svelte";
  import Header from "./components/Header.svelte";
  import ListView from "./components/ListView.svelte";
  import ListDetailView from "./components/v1/ListDetailView.svelte";
  import VoteView from "./components/VoteView.svelte";
  import EditView from "./components/EditView.svelte";
  import TickerTape from "./components/TickerTape.svelte";
  import { getStats, sendHeartbeat } from "./lib/api.js";

  let currentView = "home";
  let listName = "";

  let windowWidth = window.innerWidth;
  $: isMobile = windowWidth <= 740;

  let onlineUsers = 0;
  let votesLastHour = 0;
  let statsInterval;

  async function fetchStats() {
    try {
      const stats = await getStats();
      onlineUsers = stats.onlineUsers;
      votesLastHour = stats.votesLastHour;
    } catch (e) {}
  }

  async function heartbeat() {
    try {
      await sendHeartbeat();
    } catch (e) {}
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
    } else if (urlParams.has("view") && urlParams.get("view") === "edit") {
      listName = urlParams.get("listName") || "";
      return "edit";
    } else if (
      path.includes("create.html") ||
      (urlParams.has("view") && urlParams.get("view") === "create")
    ) {
      return "create";
    } else if (urlParams.has("view") && urlParams.get("view") === "listview") {
      listName = urlParams.get("listName") || "";
      return "listview";
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
    return () => window.removeEventListener("popstate", updateView);
  });

  onDestroy(() => {
    if (statsInterval) clearInterval(statsInterval);
  });

  currentView = getViewFromURL();
</script>

<svelte:window bind:innerWidth={windowWidth} />

<main>
  <div class="app-container" class:vote-layout={currentView === "vote"}>
    {#if currentView === "home" && isMobile}
      <TickerTape {isMobile} />
    {/if}
    {#if !(isMobile && (currentView === "listview" || currentView === "vote"))}
      <Header
        {onlineUsers}
        {votesLastHour}
        {isMobile}
        isHome={currentView === "home"}
        compact={currentView !== "home" && currentView !== "vote" && currentView !== "listview"}
        fullWidth={currentView === "vote" || currentView === "listview"}
      />
    {/if}

    {#if currentView === "home"}
      <Home {isMobile} />
    {:else if currentView === "listview"}
      <ListView {listName} {isMobile} />
    {:else if currentView === "home_v1"}
      <HomeV1 />
    {:else if currentView === "listdetail"}
      <ListDetailView {listName} />
    {:else if currentView === "vote"}
      <VoteView {listName} {isMobile} />
    {:else if currentView === "edit"}
      <EditView {listName} {isMobile} />
    {:else if currentView === "create"}
      <EditView {isMobile} />
    {/if}
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    /* height: 100vh; */
  }

  .app-container {
    display: flex;
    flex-direction: column;
    /* flex: 1; */
    min-height: 0;
    margin: 0 20px;
  }
  .app-container.vote-layout {
    height: 100dvh;
    overflow: hidden;
  }
</style>
