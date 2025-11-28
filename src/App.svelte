<script>
  import { onMount } from "svelte";
  import Home from "./components/Home.svelte";
  import ListDetailView from "./components/ListDetailView.svelte";
  import VoteView from "./components/VoteView.svelte";
  import CreateView from "./components/CreateView.svelte";

  // Simple routing based on URL params for now
  let currentView = "home";
  let listName = "";

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
    }
    return "home";
  }

  function updateView() {
    currentView = getViewFromURL();
  }

  onMount(() => {
    // Listen for navigation events (back/forward buttons)
    window.addEventListener("popstate", updateView);

    return () => {
      window.removeEventListener("popstate", updateView);
    };
  });

  currentView = getViewFromURL();
</script>

<main>
  <div class="app-container">
    {#if currentView === "home"}
      <Home />
    {:else if currentView === "listdetail"}
      <ListDetailView {listName} />
    {:else if currentView === "vote"}
      <VoteView {listName} />
    {:else if currentView === "create"}
      <CreateView />
    {/if}
  </div>
</main>
