<script>
  import { onMount } from "svelte";
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

  export let listName = "";
  export let isMobile = false;

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
        navigate(
          `/?view=listview&listName=${encodeURIComponent(title.trim())}`,
        );
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
        navigate(
          `/?view=listview&listName=${encodeURIComponent(title.trim())}`,
        );
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
  <!-- <p class="text-base">Loading...</p> -->
{:else}
  <div class="page-title text-base" class:mobile={isMobile}>{isNew ? "Creating..." : "Editing..."}</div>
  <div class="edit-container" class:mobile={isMobile}>
    <div class="actions">
      <input
        bind:this={fileInput}
        type="file"
        accept=".csv,.txt"
        on:change={handleImport}
        style="display:none"
      />
      {#if !isNew}
        <button
          class="text-base"
          on:click={() =>
            navigate(
              `/?view=listview&listName=${encodeURIComponent(listName)}`,
            )}>Back</button
        >
      {/if}
      <button class="text-base" on:click={() => fileInput.click()}
        >Import</button
      >
      <button class="text-base" on:click={save} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
      {#if !isNew}
        <button class="text-base delete" on:click={handleDelete}>Delete</button>
      {/if}
    </div>

    <div class="meta">
      <div class="field-row">
        <label class="text-base">Title</label>
        <input class="text-base" bind:value={title} placeholder="List name" />
      </div>
      <div class="field-row">
        <label class="text-base">Description</label>
        <input class="text-base" bind:value={description} placeholder="" />
      </div>
      <!-- <div class="field-row">
        <label class="text-base">Prompt</label>
        <input class="text-base" bind:value={prompt} placeholder="" />
      </div> -->
      <div class="field-row">
        <label class="text-base">Author</label>
        <input class="text-base" bind:value={author} placeholder="" />
      </div>
      <div class="field-row">
        <label class="text-base">Password</label>
        <input
          class="text-base"
          type="password"
          bind:value={password}
          placeholder=""
        />
      </div>
    </div>

    <div class="items-table">
      <div class="table-header">
        <div class="col name text-small">NAME</div>
        <div class="col url text-small">URL</div>
        <div class="col del"></div>
      </div>
      <div class="items-body">
        {#each rows as row, i}
          <div class="table-row">
            <div class="col name">
              <input class="text-base" bind:value={row.name} />
            </div>
            <div class="col url">
              <input class="text-base" bind:value={row.url} />
            </div>
            <div class="col del">
              <button class="text-small" on:click={() => removeRow(i)}>×</button
              >
            </div>
          </div>
        {/each}
      </div>
      <div class="table-row add-row">
        <button class="text-base" on:click={addRow}>add row</button>
      </div>
    </div>

    {#if error}
      <p class="error text-base">{error}</p>
    {/if}

    <div class="pitch-section">
      <div class="pitch-label text-base">Don't feel like creating a list?</div>
      <div class="meta">
        <div class="field-row">
          <label class="text-base">List idea</label>
          <input class="text-base" placeholder="" />
        </div>
        <div class="field-row">
          <label class="text-base">Why</label>
          <input class="text-base" placeholder="" />
        </div>
        <div class="field-row">
          <label class="text-base">Your name</label>
          <input class="text-base" placeholder="" />
        </div>
      </div>
      <button class="text-base pitch-submit">Submit</button>
    </div>
  </div>
{/if}

<style>
  .edit-container {
    width: var(--desktop-max-width);
    margin: auto;
    display: flex;
    flex-direction: column;
    margin-top: var(--spacing-md);
  }
  .edit-container.mobile {
    width: 100%;
  }

  .page-title {
    text-transform: uppercase;
    z-index: 3;
    position: sticky;
    top: 20px;
    margin-left: calc((100vw - var(--desktop-max-width)) / 2 - 20px);
    margin-bottom: var(--spacing-xlg);
  }
  .page-title.mobile {
    margin-left: 0;
  }

  .meta {
    display: flex;
    flex-direction: column;
    text-transform: uppercase;
    /* margin: var(--spacing-lg) 0; */
    margin-bottom: var(--spacing-xlg);
  }

  .field-row {
    display: flex;
    align-items: center;
    height: var(--cell-height);
    border-bottom: var(--border);
  }

  label {
    width: 200px;
    flex-shrink: 0;
    color: var(--color-text-faded);
  }

  .field-row input,
  .table-row input {
    flex: 1;
    border: none;
    outline: none;
    padding: 0;
    background: transparent;
    width: 100%;
  }

  .items-table {
    display: flex;
    flex-direction: column;
  }

  .table-header,
  .table-row {
    display: flex;
    align-items: center;
    height: var(--cell-height);
    border-bottom: var(--border);
  }

  .items-body .table-row:last-child {
    border-bottom: none;
  }

  .table-header {
    color: var(--color-text-faded);
  }

  .col.name {
    flex: 1;
  }

  .col.url {
    flex: 2;
  }

  .col.del {
    width: 30px;
    flex-shrink: 0;
    text-align: center;
  }

  .col.del button {
    background: none;
    border: none;
    cursor: pointer;
    /* padding: 0; */
  }

  .col.del button:hover {
    color: black;
  }

  .add-row {
    border-bottom: none;
    padding: var(--spacing-md) 0;
    margin-bottom: var(--spacing-xlg);
    /* justify-content: flex-end; */
  }

  .add-row button {
    /* background: none;/ */
    /* border: none; */
    cursor: pointer;
  }

  .pitch-section {
    margin-top: var(--spacing-xlg);
  }

  .pitch-label {
    color: var(--color-text-faded);
    text-transform: uppercase;
    margin-bottom: var(--spacing-md);
  }

  .pitch-submit {
    margin: 0;
    margin-top: var(--spacing-md);
  }

  .actions {
    position: fixed;
    top: 12px;
    right: 20px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--spacing-md);
    z-index: 3;
  }

  .actions button {
    margin: 0;
  }

  .error {
    color: red;
  }
</style>
