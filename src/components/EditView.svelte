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
  let passwordInputEl;
  let showDropdown = false;

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
    if (!isNew && !password) {
      passwordHighlight = false;
      await tick();
      passwordHighlight = true;
      passwordInputEl?.focus();
      setTimeout(() => (passwordHighlight = false), 1500);
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
        navigate(`/?view=vote&listName=${encodeURIComponent(title.trim())}`);
      }
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${listName}"?`)) return;
    try {
      setListPassword(listName, password);
      await deleteList(listName);
      navigate("/");
    } catch (e) {
      error = e.message;
    }
  }
</script>

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

    <div class="meta">
      <div class="field-row">
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
    </div>

    <div class="items-table">
      <div class="table-header">
        <span class="col-name text-small">Name</span>
        <div class="col-thumb"></div>
        <span class="col-url text-small">URL</span>
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
      <div class="add-row">
        <button class="text-small" on:click={addRow}>+ Add</button>
      </div>
    </div>

    {#if error}
      <p class="error text-small">{error}</p>
    {/if}
  </div>

  <button class="edit-fab text-small active" on:click={save} disabled={saving}>
    {isNew ? (saving ? "Creating" : "Create") : saving ? "Saving" : "Editing"}
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

  /* meta rows */
  .meta {
    display: flex;
    flex-direction: column;
    text-transform: uppercase;
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-margin);
    padding-bottom: var(--spacing-md);
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
    border-bottom: 1px solid var(--color-black);
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
    padding: var(--spacing-margin);
    gap: var(--spacing-md);
  }

  .table-header {
    display: flex;
    gap: var(--spacing-md);
    padding-bottom: var(--spacing-md);
    border-bottom: var(--border);
    color: var(--color-text-faded);
    text-transform: uppercase;
  }

  @media (min-width: 740px) {
    .table-header {
      align-items: center;
      padding-left: 2px;
    }
  }

  .table-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding-bottom: var(--spacing-md);
    border-bottom: var(--border);
    min-height: calc(25px + var(--spacing-md));
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
    padding-top: var(--spacing-md);
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
    color: var(--color-white);
    background-color: var(--color-black);
    border-color: var(--color-black);
  }

  .edit-fab:disabled {
    opacity: 0.7;
  }
</style>
