<script>
  import { onMount } from "svelte";

  import View from "./Views/View.svelte";
  import Edit from "./Views/Edit.svelte";
  import { getSortedList, getListInfo } from "../lib/api.js";

  export let listName = "";

  // Get listName from URL if not provided as prop
  if (!listName) {
    const searchParams = new URLSearchParams(window.location.search);
    listName = searchParams.get("listName") || "";
  }

  // View mode: 'grid' for cards, 'list' for table view, 'edit' for editing
  let viewMode = "grid";
  let viewSize = "small"; // For grid mode: 'small', 'medium', 'large'

  // Data state
  let items = [];
  let listInfo = {};
  let loading = true;
  let error = null;

  // Editing state
  let dirty = false;
  let metadataDirty = false;
  let tableData = [];

  // Form fields for passing to Edit component
  let listTitle = "";
  let listDescription = "";
  let listPrompt = "";
  let listAuthor = "";

  // Check URL for view mode
  function getViewModeFromURL() {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);

    if (path.includes("list.html")) {
      return "list";
    } else if (searchParams.get("mode") === "edit") {
      return "edit";
    }
    return "grid";
  }

  viewMode = getViewModeFromURL();

  async function loadData() {
    if (!listName) {
      error = "No list name provided";
      loading = false;
      return;
    }

    try {
      loading = true;
      error = null;

      // Load list data and info in parallel
      const [sortedList, info] = await Promise.all([
        getSortedList(listName),
        getListInfo(listName),
      ]);

      items = sortedList || [];
      listInfo = info || {};

      // Set form fields for Edit component
      listTitle = listName;
      listDescription = listInfo.description || "";
      listPrompt = listInfo.prompt || "";
      listAuthor = listInfo.author || "";

      // Prepare table data for editing mode
      tableData = items.map((d) => ({
        name: d.name,
        picture: d.data?.picture || "",
        description: d.data?.description || "",
        elo: d.elo,
      }));

      // Format timestamp if available
      if (listInfo.lastVoteTimestamp) {
        const options = { year: "numeric", month: "long", day: "numeric" };
        const date = new Date(listInfo.lastVoteTimestamp);
        listInfo.lastVoteTimestamp = date.toLocaleDateString("en-US", options);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function toggleViewSize(size) {
    viewSize = size;
  }

  function switchViewMode(mode) {
    viewMode = mode;
    // Update URL without page reload
    const newUrl = new URL(window.location);

    if (mode === "list") {
      newUrl.pathname = "/list.html";
      newUrl.searchParams.delete("mode");
    } else if (mode === "edit") {
      newUrl.searchParams.set("mode", "edit");
    } else {
      newUrl.pathname = "/grid.html";
      newUrl.searchParams.delete("mode");
    }

    window.history.pushState({}, "", newUrl);
  }

  // Event handlers for Edit component
  function handleNameChanged(event) {
    const newName = event.detail.newName;
    // Update URL to reflect new list name
    const newUrl = new URL(window.location);
    newUrl.searchParams.set("listName", newName);
    window.history.replaceState({}, "", newUrl);
    listName = newName;
  }

  function handleSaved() {
    // Reload data to reflect changes
    dirty = false;
    metadataDirty = false;
    loadData();
  }

  function handleSave() {
    // Trigger save in Edit component
    if (editComponent) {
      editComponent.save();
    }
  }

  function handleDelete() {
    // Trigger delete in Edit component
    if (editComponent) {
      editComponent.deleteCurrentList();
    }
  }

  function handleGoBack() {
    // Discard changes and go back to grid view
    dirty = false;
    metadataDirty = false;

    // Reload data to reset any unsaved changes
    loadData();

    // Switch back to grid view
    switchViewMode("grid");
  }

  let editComponent;

  onMount(() => {
    loadData();
  });
</script>

<svelte:head>
  <title>{viewMode === "edit" ? "Edit" : "View"} - {listName}</title>
</svelte:head>

<div class="list-detail-container">
  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">Error: {error}</div>
  {:else if viewMode === "edit"}
    <!-- Edit Mode -->
    <Edit
      bind:this={editComponent}
      {items}
      {listName}
      bind:listTitle
      bind:listDescription
      bind:listPrompt
      bind:listAuthor
      bind:dirty
      bind:metadataDirty
      bind:tableData
      on:nameChanged={handleNameChanged}
      on:saved={handleSaved}
    />
  {:else}
    <!-- List or Grid View Mode -->
    <View {items} {viewSize} {viewMode} {listName} {listInfo} />
  {/if}
</div>

<style>
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

  .view-controls {
    display: flex;
    gap: 5px;
    align-items: center;
  }

  .view-type-controls,
  .size-controls {
    display: flex;
    gap: 0.25rem;
  }

  .size-controls button.clicked {
    color: blue;
  }

  .action-buttons {
    display: flex;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
    100% {
      opacity: 1;
    }
  }
  .settings {
    display: flex;

    justify-content: space-between;
  }
  .actions {
    display: flex;
    gap: 5px;
  }

  .loading,
  .error {
    text-align: center;
    padding: 2rem;
    font-size: 1.2rem;
  }

  .error {
    color: red;
  }

  .delete-btn {
    color: red;
  }

  .edit.actions {
    display: flex;
    justify-content: space-between;
    width: 100%;
  }
</style>
