<script>
  import { onMount } from "svelte";
  import Home from "./components/Home.svelte";
  import VoteView from "./components/VoteView.svelte";
  import EditView from "./components/EditView.svelte";
  import TickerTape from "./components/TickerTape.svelte";
  import Header from "./components/Header.svelte";
  import VotePreview from "./components/VotePreview.svelte";
  import HomeDropdown from "./components/HomeDropdown.svelte";
  let currentView = "home";
  let listName = "";
  let activeListName = "";

  let windowWidth = window.innerWidth;
  $: isMobile = windowWidth <= 740;

  function getViewFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (
      path.includes("vote.html") ||
      (urlParams.has("view") && urlParams.get("view") === "vote") ||
      (urlParams.has("view") &&
        (urlParams.get("view") === "listview" ||
          urlParams.get("view") === "grid" ||
          urlParams.get("view") === "list"))
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
    }
    return "home";
  }

  function updateView() {
    currentView = getViewFromURL();
  }

  onMount(() => {
    window.addEventListener("popstate", updateView);
    return () => window.removeEventListener("popstate", updateView);
  });

  currentView = getViewFromURL();
</script>

<svelte:window bind:innerWidth={windowWidth} />

<main>
  <div
    class="app-container"
    class:vote-layout={currentView === "vote"}
    class:mobile-home={currentView === "home" && isMobile}
    class:desktop-home={currentView === "home" && !isMobile}
    class:mobile-edit={(currentView === "edit" || currentView === "create") &&
      isMobile}
  >
    {#if currentView === "home" && isMobile}
      <Header />
      <TickerTape {isMobile} />
      <div class="mobile-info text-small">
        A pairwise ranking tool powered by the Elo algorithm. Your ranking
        problems solved.
      </div>
      <VotePreview listName={activeListName} />
      <HomeDropdown
        isMobile={true}
        on:activeList={(e) => (activeListName = e.detail.listName)}
      />
    {/if}
    {#if !isMobile}
      <Header />
    {/if}

    {#if currentView === "home"}
      <Home {isMobile} />
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
    padding: var(--spacing-sm);
    gap: var(--spacing-sm);
  }

  .mobile-info {
    padding: var(--spacing-margin);
    text-align: center;
    text-transform: uppercase;
  }
  .app-container.vote-layout {
    height: calc(100dvh - 2 * var(--spacing-sm));
    overflow: hidden;
  }

  .app-container.mobile-home {
    height: 100dvh;
    overflow: hidden;
  }

  .app-container.mobile-edit {
    height: 100dvh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .app-container.desktop-home {
    height: calc(100dvh - 2 * var(--spacing-sm));
    overflow: hidden;
  }
</style>
