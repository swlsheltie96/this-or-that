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
  let showMobileInfo = false;

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
      {#if !showMobileInfo}
        <div class="mobile-info text-small">
          A pairwise ranking tool powered by the Elo algorithm. Your ranking
          problems solved.
        </div>
        <VotePreview listName={activeListName} />
      {:else}
        <div class="mobile-info-block text-small">Voting uses the Elo rating system — the same algorithm used to rank chess players. Every vote is a weighted matchup, not just a tally. The live Elo score animates in real time, so you can watch the rankings shift as you go.</div>
      {/if}
      <div class="mobile-list-wrap">
        <HomeDropdown
          isMobile={true}
          on:activeList={(e) => (activeListName = e.detail.listName)}
        />
      </div>
      <div class="mobile-bottom-bar text-base">
        <button class="mobile-bottom-link" on:click={() => (showMobileInfo = !showMobileInfo)}>{showMobileInfo ? 'Close' : 'Info'}</button>
        <a class="mobile-bottom-link" href="https://www.instagram.com/this____or__that?utm_source=qr" target="_blank" rel="noopener noreferrer">Follow</a>
      </div>
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
    flex-shrink: 0;
  }

  .mobile-info-block {
    padding: var(--spacing-margin);
    text-align: center;
    text-transform: uppercase;
    line-height: 1.6;
    flex-shrink: 0;
  }

  .mobile-list-wrap {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .mobile-bottom-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-margin);
    flex-shrink: 0;
    background: var(--color-lime);
    border-radius: var(--border-radius);
    text-transform: uppercase;
  }

  .mobile-bottom-link {
    color: var(--color-black);
    text-decoration: underline;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-family);
    font-size: inherit;
    text-transform: uppercase;
    padding: 0;
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
