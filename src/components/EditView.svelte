<script>
  import { onMount, tick } from "svelte";
  import {
    createList,
    updateListMetadata,
    updateItem,
    deleteList,
    addItem,
    deleteItem,
    getSortedList,
    getListInfo,
    getListPassword,
    setListPassword,
    navigate,
  } from "../lib/api.js";
  import Header from "./Header.svelte";
  import HomeDropdown from "./HomeDropdown.svelte";

  export let listName = "";
  export let isMobile = false; // used only to conditionally show Header

  const isNew = !listName;

  let title = listName;
  let description = "";
  let prompt = "";
  let author = "";
  let password = "";

  let rows = Array.from({ length: 5 }, () => ({ name: "", url: "" }));
  let existingItemNames = new Set();

  let loading = !isNew;
  let saving = false;
  let error = "";
  let passwordHighlight = false;
  let titleHighlight = false;
  let passwordInputEl;
  let showDropdown = false;

  async function flashHighlight(setter, inputEl = null) {
    setter(false);
    await tick();
    setter(true);
    inputEl?.focus();
    setTimeout(() => setter(false), 1500);
  }

  let createSuccess = false;
  let saveSuccess = false;
  let deleteInProgress = false;
  let confirmDelete = false;
  let isSuggestion = false;
  let suggEmail = "";
  let suggSubmitted = false;

  async function submitSuggestion() {
    if (!title.trim()) {
      flashHighlight((v) => (titleHighlight = v));
      return;
    }
    try {
      await fetch("/suggest-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          author: author.trim(),
          email: suggEmail.trim(),
        }),
      });
    } catch (e) {}
    title = "";
    description = "";
    author = "";
    suggEmail = "";
    suggSubmitted = true;
    setTimeout(() => (suggSubmitted = false), 3000);
  }

  onMount(async () => {
    if (isNew) return;
    password = getListPassword(listName);
    try {
      const [items, info] = await Promise.all([
        getSortedList(listName),
        getListInfo(listName),
      ]);
      title = listName;
      description = info.description || "";
      prompt = info.prompt || "";
      author = info.author || "";
      rows = items.length
        ? items.map((item) => ({
            name: item.name,
            url: item.data?.picture || "",
          }))
        : [{ name: "", url: "" }];
      existingItemNames = new Set(items.map((item) => item.name));
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  let fileInput;

  function addRow() {
    rows = [...rows, { name: "", url: "" }];
  }

  function removeRow(i) {
    rows = rows.filter((_, idx) => idx !== i);
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.trim().split("\n");
      const imported = lines
        .map((line) => {
          const [name, url = ""] = line.split(",").map((s) => s.trim());
          return { name, url };
        })
        .filter((r) => r.name);
      if (imported.length)
        rows = [...rows.filter((r) => r.name.trim()), ...imported];
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function save() {
    if (saving) return;
    if (!title.trim()) {
      flashHighlight((v) => (titleHighlight = v));
      return;
    }
    if (!isNew && !password) {
      flashHighlight((v) => (passwordHighlight = v), passwordInputEl);
      return;
    }
    saving = true;
    error = "";
    try {
      const validRows = rows.filter((r) => r.name.trim());
      if (isNew) {
        await createList(
          title.trim(),
          { description, prompt, author },
          password,
        );
        setListPassword(title.trim(), password);
        for (const row of validRows) {
          await addItem(title.trim(), {
            name: row.name.trim(),
            data: { picture: row.url },
          });
        }
        createSuccess = true;
        await new Promise((r) => setTimeout(r, 2000));
        navigate(`/?view=vote&listName=${encodeURIComponent(title.trim())}`);
      } else {
        setListPassword(listName, password);
        await updateListMetadata(
          listName,
          title.trim(),
          description,
          prompt,
          author,
          "",
        );
        const keptNames = new Set(validRows.map((r) => r.name.trim()));
        for (const name of existingItemNames) {
          if (!keptNames.has(name)) await deleteItem(listName, name);
        }
        for (const row of validRows) {
          const name = row.name.trim();
          const data = { picture: row.url };
          if (existingItemNames.has(name)) {
            await updateItem(title.trim(), name, data);
          } else {
            await addItem(title.trim(), { name, data });
          }
        }
        saveSuccess = true;
        await new Promise((r) => setTimeout(r, 2000));
        navigate(`/?view=vote&listName=${encodeURIComponent(title.trim())}`);
      }
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    if (!password.trim()) {
      flashHighlight((v) => (passwordHighlight = v), passwordInputEl);
      return;
    }
    if (!confirmDelete) {
      confirmDelete = true;
      return;
    }
    deleteInProgress = true;
    confirmDelete = false;
    try {
      setListPassword(listName, password);
      await deleteList(listName);
      await new Promise((r) => setTimeout(r, 2000));
      navigate("/");
    } catch (e) {
      deleteInProgress = false;
      error = e.message;
    }
  }

  // // debug: D = toggle success, X = toggle delete, S = toggle saveSuccess
  // function handleKeydown(e) {
  //   if (e.key === "d" || e.key === "D") createSuccess = !createSuccess;
  //   if (e.key === "x" || e.key === "X") deleteInProgress = !deleteInProgress;
  //   if (e.key === "s" || e.key === "S") saveSuccess = !saveSuccess;
  // }
</script>

<!-- <svelte:window on:keydown={handleKeydown} /> -->

{#if loading}
  <!-- loading -->
{:else if !isNew && showDropdown}
  <div class="dropdown-overlay">
    <Header />
    <div class="list-name-bar no-border">
      <button class="text-small" disabled>Vote</button>
      <div
        class="list-name-center text-small"
        on:click={() => (showDropdown = false)}
      >
        <span>{listName}</span>
        <span class="chevron open">▾</span>
      </div>
      <button class="text-small" disabled>List</button>
    </div>
    <HomeDropdown {isMobile} />
  </div>
{:else}
  {#if isMobile}<Header />{/if}
  {#if !isNew}
    <div class="list-name-bar">
      <button class="text-small" disabled>Vote</button>
      <div
        class="list-name-center text-small"
        on:click={() => (showDropdown = true)}
      >
        <span>{listName}</span>
        <span class="chevron">▾</span>
      </div>
      <button class="text-small" disabled>List</button>
    </div>
  {/if}

  <div class="scroll-area">
    <input
      bind:this={fileInput}
      type="file"
      accept=".csv,.txt"
      on:change={handleImport}
      style="display:none"
    />

    <div
      class="field-row instruction-row"
      class:success={createSuccess || saveSuccess}
      class:deleting={deleteInProgress}
      style="padding-left: var(--spacing-margin); padding-right: var(--spacing-margin);"
    >
      <span class="text-small"
        class:success-text={createSuccess || saveSuccess}
        class:delete-text={deleteInProgress}
        style={createSuccess || saveSuccess || deleteInProgress ? "" : "color: var(--color-grey)"}
      >
        {#if createSuccess}
          list created successfully!!! :)))))
        {:else if saveSuccess}
          success. closing...
        {:else if deleteInProgress}
          Deleting... Good bye.
        {:else if isNew}
          Name your list, add some items, and start ranking.
        {:else}
          Edit your list, add or remove items.
        {/if}
      </span>
    </div>

    <div class="meta">
      <div class="field-row" class:highlight={titleHighlight}>
        <label class="text-small">Title</label>
        <input class="text-small" bind:value={title} placeholder="List name" />
      </div>
      <div class="field-row">
        <label class="text-small">Description</label>
        <input class="text-small" bind:value={description} />
      </div>
      <div class="field-row">
        <label class="text-small">Author</label>
        <input class="text-small" bind:value={author} />
      </div>
      {#if isSuggestion}
        <div class="field-row field-row-black">
          <label class="text-small">Email</label>
          <input class="text-small" type="email" bind:value={suggEmail} />
        </div>
      {/if}
      {#if !isSuggestion}
        <div
          class="field-row field-row-black"
          class:highlight={passwordHighlight}
        >
          <label class="text-small">Password</label>
          <input
            class="text-small"
            type="password"
            bind:value={password}
            bind:this={passwordInputEl}
            on:input={() => (passwordHighlight = false)}
          />
        </div>
      {/if}
    </div>

    {#if !isSuggestion}
      <div class="items-table">
        <div class="table-header">
          <span class="col-name text-small" style="color: var(--color-grey)"
            >Name</span
          >
          <div class="col-thumb"></div>
          <span class="col-url text-small" style="color: var(--color-grey)"
            >URL</span
          >
          <div class="del-spacer"></div>
        </div>
        {#each rows as row, i}
          <div class="table-row">
            <input class="col-name text-small" bind:value={row.name} />
            <div class="col-thumb">
              {#if row.url}<img src={row.url} alt="" />{/if}
            </div>
            <input class="col-url text-small" bind:value={row.url} />
            <button class="del-btn text-small" on:click={() => removeRow(i)}
              >×</button
            >
          </div>
        {/each}
      </div>
    {/if}

    <div class="add-row">
      {#if !isSuggestion}
        <button class="text-small" on:click={addRow}>+ Add</button>
      {:else}
        <div></div>
      {/if}
      {#if isNew}
        <label
          class="text-small suggest-check"
          style="color: var(--color-grey)"
        >
          <input type="checkbox" bind:checked={isSuggestion} />
          Don't want to create a list? Suggest one instead
        </label>
      {:else}
        <div class="delete-group">
          <button class="text-small delete-btn" on:click={handleDelete}>Delete</button>
          {#if confirmDelete}
            <button class="text-small delete-btn confirm-delete-btn" on:click={handleDelete}>Are you sure?</button>
          {/if}
        </div>
      {/if}
    </div>

    {#if error}
      <p class="error text-small">{error}</p>
    {/if}
  </div>

  <button
    class="edit-fab text-small"
    on:click={isSuggestion ? submitSuggestion : save}
    disabled={saving}
  >
    {#if isSuggestion}
      {suggSubmitted ? "Suggested!" : "Suggest List"}
    {:else}
      {isNew ? (saving ? "Submitting" : "Submit") : saving ? "Saving" : "Save and Close"}
    {/if}
  </button>
{/if}

<style>
  /* ── Mobile layout ────────────────────────────────── */

  .dropdown-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--color-white);
    z-index: 50;
    display: flex;
    flex-direction: column;
  }

  .list-name-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-margin);
    border-bottom: var(--border);
    gap: var(--spacing-md);
  }

  .list-name-bar.no-border {
    border-bottom: none;
  }

  .list-name-center {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-md);
    cursor: pointer;
    text-transform: uppercase;
    min-width: 0;
  }

  .list-name-center span:first-child {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .chevron {
    flex-shrink: 0;
    transition: transform 0.2s ease;
    transform: rotate(180deg);
  }

  .chevron.open {
    transform: rotate(0deg);
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .scroll-area {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 60px;
  }

  .instruction-row {
    text-transform: uppercase;
  }

  .success-text {
    color: var(--color-green) !important;
  }

  .delete-text {
    color: var(--color-red) !important;
  }

  /* meta rows */
  .meta {
    display: flex;
    flex-direction: column;
    text-transform: uppercase;
    padding: 0 var(--spacing-margin);
    border-bottom: 1px solid black;
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-margin) 0;
    border-bottom: var(--border);
    /* min-height: calc(25px + var(--spacing-md)); */
  }

  .field-row label {
    flex-shrink: 0;
    width: fit-content;
  }

  .field-row input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    text-align: right;
    text-transform: uppercase;
    min-width: 0;
  }

  .field-row-black {
    border-bottom: unset;
  }

  .field-row.highlight label {
    background-color: red;
    color: white;
    animation: fadeHighlight 1500ms ease forwards;
  }

  @keyframes fadeHighlight {
    0%,
    66% {
      background-color: red;
      color: white;
    }
    100% {
      background-color: transparent;
      color: inherit;
    }
  }

  /* items table */
  .items-table {
    display: flex;
    flex-direction: column;
    padding: 0 var(--spacing-margin);
  }

  .table-header {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-margin) 0;
    border-bottom: var(--border);
    color: var(--color-text-faded);
    text-transform: uppercase;
    align-items: center;
  }

  .table-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-margin) 0;
    border-bottom: var(--border);
  }

  .col-name {
    flex: 1;
    min-width: 0;
  }

  .col-url {
    flex: 1.5;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .table-row .col-name,
  .table-row .col-url {
    border: none;
    outline: none;
    background: transparent;
    text-transform: uppercase;
    min-width: 0;
    width: 100%;
  }

  .col-thumb {
    width: 25px;
    height: 25px;
    flex-shrink: 0;
    overflow: hidden;
  }

  .col-thumb img,
  .thumb-empty {
    width: 100%;
    height: 100%;
    object-fit: cover;
    aspect-ratio: 1;
  }

  .thumb-empty {
    background: var(--color-grey);
  }

  .del-spacer {
    flex-shrink: 0;
    width: 20px;
  }

  .del-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    width: 20px;
    text-align: center;
  }

  .add-row {
    padding: var(--spacing-md);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .delete-group {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--spacing-sm);
  }

  .delete-btn {
    color: var(--color-red);
    border-color: var(--color-red);
  }

  .suggest-check {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    cursor: pointer;
    text-transform: uppercase;
  }

  .suggest-check input[type="checkbox"] {
    accent-color: var(--color-black);
  }

  .error {
    padding: var(--spacing-margin);
    color: red;
  }

  .edit-fab {
    position: fixed;
    bottom: var(--spacing-margin);
    right: var(--spacing-margin);
    z-index: 10;
    cursor: pointer;
    color: var(--color-black);
    background-color: var(--color-white);
    border-color: var(--color-black);
  }

  .edit-fab:hover {
    color: var(--color-white);
    background-color: var(--color-black);
  }

  .edit-fab.active {
    color: var(--color-white);
    background-color: var(--color-black);
    border-color: var(--color-black);
  }

  .edit-fab:disabled {
    opacity: 0.7;
  }
</style>
