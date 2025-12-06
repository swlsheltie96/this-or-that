<script>
  import { createEventDispatcher, afterUpdate } from "svelte";
  import { updateListMetadata, deleteList, addItem, deleteItem } from "../../lib/api.js";

  export let items = [];
  export let listName = "";
  export let listTitle = "";
  export let listDescription = "";
  export let listPrompt = "";
  export let listAuthor = "";
  export let dirty = false;
  export let metadataDirty = false;
  export let tableData = [];

  const dispatch = createEventDispatcher();

  let initialMetadata = {};

  // Set initial metadata when component loads
  $: if (listTitle && !initialMetadata.name) {
    initialMetadata = {
      name: listTitle,
      description: listDescription,
      prompt: listPrompt,
      author: listAuthor,
    };
  }

  // Track metadata changes
  $: {
    const currentMetadata = {
      name: listTitle,
      description: listDescription,
      prompt: listPrompt,
      author: listAuthor,
    };
    metadataDirty = JSON.stringify(currentMetadata) !== JSON.stringify(initialMetadata);
  }

  function findObjectDifference(oldList, newList) {
    const oldMap = new Map();
    const newMap = new Map();

    for (const item of oldList) {
      oldMap.set(item.name, item);
    }

    for (const item of newList) {
      newMap.set(item.name, item);
    }

    const added = [];
    const removed = [];
    const updated = [];

    // Check for added and updated items
    for (const [name, newItem] of newMap) {
      const oldItem = oldMap.get(name);

      if (!oldItem) {
        added.push(newItem);
      } else if (!isObjectEqual(oldItem, newItem)) {
        updated.push(newItem);
      }
    }

    // Check for removed items
    for (const [name, oldItem] of oldMap) {
      if (!newMap.has(name)) {
        removed.push(oldItem);
      }
    }

    return { added, removed, updated };
  }

  function isObjectEqual(objA, objB) {
    return objA.picture === objB.picture && objA.description === objB.description;
  }

  async function saveChanges() {
    try {
      // Validate that all items have names
      const itemsWithoutNames = tableData.filter(item => !item.name || !item.name.trim());
      if (itemsWithoutNames.length > 0) {
        alert(`Cannot save: ${itemsWithoutNames.length} item(s) are missing names. All items must have a name.`);
        return;
      }

      // Save metadata changes if any
      if (metadataDirty) {
        await updateListMetadata(listName, listTitle, listDescription, listPrompt, listAuthor);

        // Update initial metadata and dispatch event if name changed
        initialMetadata = {
          name: listTitle,
          description: listDescription,
          prompt: listPrompt,
          author: listAuthor,
        };

        if (listTitle !== listName) {
          dispatch("nameChanged", { newName: listTitle });
        }

        metadataDirty = false;
      }

      // Prepare initial data from items for comparison
      const initialData = items.map((d) => ({
        name: d.name,
        picture: d.data?.picture || "",
        description: d.data?.description || "",
        elo: d.elo,
      }));

      // Save item changes
      const diffs = findObjectDifference(initialData, tableData);

      // Process all deletes first
      for (let row of diffs.removed) {
        await deleteItem(listName, row.name);
      }

      // Process all updates (delete then add)
      for (let row of diffs.updated) {
        await deleteItem(listName, row.name);
      }
      for (let row of diffs.updated) {
        await addItem(listName, {
          name: row.name,
          data: {
            picture: row.picture,
            description: row.description,
          },
        });
      }

      // Process all adds last
      for (let row of diffs.added) {
        await addItem(listName, {
          name: row.name,
          data: {
            picture: row.picture,
            description: row.description,
          },
        });
      }

      dirty = false;
      alert("Saved successfully!");

      // Dispatch event to reload data
      dispatch("saved");
    } catch (error) {
      console.error("Failed to save:", error);
      alert("Failed to save changes. Please try again.");
    }
  }

  async function handleDeleteList() {
    if (confirm("Are you sure you want to delete this list? This action cannot be undone.")) {
      try {
        await deleteList(listName);
        window.location.href = "/";
      } catch (error) {
        console.error("Failed to delete list:", error);
        alert("Failed to delete list. Please try again.");
      }
    }
  }

  function addNewItem() {
    tableData = [...tableData, { name: "", picture: "", description: "", elo: 1000 }];
    dirty = true;
  }

  function removeItem(index) {
    tableData = tableData.filter((_, i) => i !== index);
    dirty = true;
  }

  // Public methods that can be called from parent component
  export function save() {
    return saveChanges();
  }

  export function deleteCurrentList() {
    return handleDeleteList();
  }

  function handleInputChange(event) {
    dirty = true;
    // Auto-resize textarea on input
    if (event.target.tagName === "TEXTAREA") {
      event.target.style.height = "auto";
      event.target.style.height = event.target.scrollHeight + "px";
    }
  }

  function handlePaste(event, index, field) {
    const pastedText = event.clipboardData.getData('text');
    const lines = pastedText.split('\n').filter(line => line.trim());

    // If multiple lines, fill or create multiple rows
    if (lines.length > 1) {
      event.preventDefault();

      // Fill existing rows and create new ones as needed
      for (let i = 0; i < lines.length; i++) {
        const targetIndex = index + i;

        if (targetIndex < tableData.length) {
          // Row exists, fill it
          tableData[targetIndex][field] = lines[i];
        } else {
          // Row doesn't exist, create it
          const newItem = { name: "", picture: "", description: "", elo: 1000 };
          newItem[field] = lines[i];
          tableData.push(newItem);
        }
      }

      tableData = [...tableData]; // Trigger reactivity
      dirty = true;
    }
  }

  let csvFile = null;
  let csvItems = [];
  let sortOrder = "elo"; // "elo" or "alphabetical"

  function sortTableData() {
    if (sortOrder === "elo") {
      tableData = [...tableData].sort((a, b) => b.elo - a.elo);
    } else if (sortOrder === "alphabetical") {
      tableData = [...tableData].sort((a, b) => a.name.localeCompare(b.name));
    }
    dirty = true;
  }

  function toggleSort() {
    sortOrder = sortOrder === "elo" ? "alphabetical" : "elo";
    sortTableData();
  }

  function handleFileChange(event) {
    const file = event.target.files[0];
    if (!file) {
      csvFile = null;
      csvItems = [];
      return;
    }

    csvFile = file;

    // Parse CSV and auto-import
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      csvItems = parseCSV(text);

      // Auto-import after parsing
      if (csvItems.length > 0) {
        importCSV();
        alert(`Imported ${csvItems.length} items from CSV`);
      }
    };
    reader.readAsText(file);
  }

  function parseCSV(text) {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length === 0) return [];

    // Check if first line is a header
    const firstLine = lines[0].toLowerCase();
    const hasHeader =
      firstLine.includes("name") ||
      firstLine.includes("picture") ||
      firstLine.includes("description");

    const dataLines = hasHeader ? lines.slice(1) : lines;

    return dataLines
      .map((line) => {
        // Simple CSV parsing (handles quoted fields)
        const fields = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
        const cleanFields = fields.map((f) => f.replace(/^"|"$/g, "").trim());

        const item = {
          name: cleanFields[0] || "",
          picture: cleanFields[1] || "",
          description: cleanFields[2] || "",
          elo: 1000,
        };

        return item;
      })
      .filter((item) => item.name); // Only include items with names
  }

  function importCSV() {
    if (csvItems.length === 0) return;

    // Append CSV items to existing tableData
    tableData = [...tableData, ...csvItems];
    dirty = true;

    // Clear the CSV input
    csvFile = null;
    csvItems = [];
    document.getElementById("csvFile").value = "";
  }
</script>

<div class="edit-container">
  <!-- Title Row -->
  <div class="title-row">
    <a href="/" class="title-cell">ELO CHAMBER</a>
  </div>

  <!-- Form Fields Row -->
  <div class="form-fields-row">
    <div class="label-cell">TITLE:</div>
    <div class="input-cell">
      <input
        type="text"
        id="listTitle"
        bind:value={listTitle}
        on:input={() => (metadataDirty = true)}
        placeholder="INPUT"
      />
    </div>

    <div class="label-cell">LIST DESCRIP:</div>
    <div class="input-cell">
      <input
        type="text"
        id="listDescription"
        bind:value={listDescription}
        on:input={() => (metadataDirty = true)}
        placeholder="INPUT"
      />
    </div>

    <div class="label-cell">VOTING PROMPT:</div>
    <div class="input-cell">
      <input
        type="text"
        id="listPrompt"
        bind:value={listPrompt}
        on:input={() => (metadataDirty = true)}
        placeholder="INPUT"
      />
    </div>

    <div class="label-cell">AUTHOR:</div>
    <div class="input-cell">
      <input
        type="text"
        id="listAuthor"
        bind:value={listAuthor}
        on:input={() => (metadataDirty = true)}
        placeholder="INPUT"
      />
    </div>
  </div>

  <!-- Action Buttons Row -->
  <div class="action-buttons-row">
    <div class="button-cell">
      <button class="action-button" on:click={() => window.history.back()}> VIEW </button>
    </div>
    <div class="button-cell">
      <button class="action-button" on:click={handleDeleteList}> DELETE </button>
    </div>
    <div class="button-cell">
      <button class="action-button" on:click={saveChanges}> SAVE </button>
    </div>
    <div class="button-cell">
      <button class="action-button" on:click={() => document.getElementById("csvFile").click()}>
        IMPORT
      </button>
    </div>
    <div class="button-cell">
      <button class="action-button" on:click={toggleSort}>
        SORT: {sortOrder === "elo" ? "ELO" : "A-Z"}
      </button>
    </div>
  </div>

  <!-- Hidden CSV file input -->
  <input
    type="file"
    id="csvFile"
    accept=".csv"
    on:change={handleFileChange}
    style="display: none;"
  />

  <!-- Items Table -->

  <div class="items-table">
    <!-- Header Row -->
    <div class="table-row header-row">
      <div class="table-cell item-cell">Item</div>
      <div class="table-cell url-cell">Picture URL</div>
      <div class="table-cell preview-cell">Preview</div>
      <div class="table-cell description-cell">Description</div>
      <div class="table-cell elo-cell">Elo</div>
      <div class="table-cell actions-cell">Actions</div>
    </div>

    <!-- Data Rows -->
    {#each tableData as item, index}
      <div class="table-row data-row">
        <div class="table-cell item-cell">
          <textarea
            bind:value={item.name}
            on:input={handleInputChange}
            on:paste={(e) => handlePaste(e, index, 'name')}
            placeholder="Item name"
          />
        </div>
        <div class="table-cell url-cell">
          <textarea
            bind:value={item.picture}
            on:input={handleInputChange}
            on:paste={(e) => handlePaste(e, index, 'picture')}
            placeholder="Image URL"
          />
        </div>
        <div class="table-cell preview-cell">
          {#if item.picture}
            <img src={item.picture} alt={item.name} class="picture-preview" />
          {/if}
        </div>
        <div class="table-cell description-cell">
          <textarea
            bind:value={item.description}
            on:input={handleInputChange}
            on:paste={(e) => handlePaste(e, index, 'description')}
            placeholder="Description"
          />
        </div>
        <div class="table-cell elo-cell">{item.elo.toFixed(2)}</div>
        <div class="table-cell actions-cell">
          <button class="delete-item" on:click={() => removeItem(index)}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="1" y1="1" x2="11" y2="11" stroke="black" stroke-width="2" stroke-linecap="round"/>
              <line x1="11" y1="1" x2="1" y2="11" stroke="black" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    {/each}
  </div>

  <!-- Add Item Button Row -->
  <div class="add-item-row">
    <div class="add-button-cell">
      <button class="add-btn" on:click={addNewItem}>+ ADD ITEM</button>
    </div>
  </div>
</div>

<style>
  .edit-container {
    display: flex;
    flex-direction: column;
  }

  /* Title Row */
  .title-row {
    display: flex;
    height: var(--cell-height);
    border: var(--border);
    border-bottom: none;
  }

  .title-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    font-family: var(--font-family);
    font-size: var(--font-size-header);
    padding: 0 var(--spacing-sm);
    text-decoration: none;
    color: inherit;
  }

  .title-cell:hover {
    text-decoration: underline;
  }

  /* Form Fields Row */
  .form-fields-row {
    display: flex;
    align-items: stretch;
    height: var(--cell-height);
    border: var(--border);
    border-bottom: none;
    margin-left: -1px;
  }

  .label-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--spacing-md);
    border-left: var(--border);
    font-family: var(--font-family);
    font-size: var(--font-size-header);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .input-cell {
    display: flex;
    align-items: center;
    flex: 1;
    padding: var(--spacing-xs);
    border-left: var(--border);
  }

  .input-cell input {
    width: 100%;
    height: 100%;
    border: var(--border);
    border-radius: var(--border-radius-button);
    padding: 0 var(--spacing-md);
    font-family: var(--font-family);
    font-size: var(--font-size-header);
  }

  .input-cell input::placeholder {
    color: var(--color-text-faded);
  }

  /* Action Buttons Row */
  .action-buttons-row {
    display: flex;
    align-items: stretch;
    height: var(--cell-height);
    border: var(--border);
    margin-left: -1px;
  }

  .button-cell {
    display: flex;
    align-items: center;
    padding: var(--spacing-xs);
    border-left: var(--border);
  }

  .action-button {
    height: var(--button-height);
    border: var(--border-button);
    border-radius: var(--border-radius-button);
    background: var(--color-white);
    padding: 0 var(--spacing-sm);
    font-family: var(--font-family);
    font-size: var(--font-size-content);
    cursor: pointer;
    white-space: nowrap;
  }

  .action-button:hover {
    background: var(--color-black);
    color: var(--color-white);
  }

  /* Items Table */
  .items-table {
    border: none;
  }

  .table-row {
    display: flex;
    align-items: stretch;
    border: var(--border);
    border-top: none;
    margin-left: -1px;
  }

  .table-cell {
    display: flex;
    align-items: center;
    padding: var(--spacing-sm);
    border-left: var(--border);
    font-family: var(--font-family);
    min-height: var(--cell-height);
    box-sizing: border-box;
  }

  .data-row .description-cell {
    align-items: stretch;
  }

  .header-row .description-cell {
    align-items: center;
  }

  /* Header Row */
  .header-row .table-cell {
    font-size: var(--font-size-header);
    text-transform: uppercase;
    justify-content: center;
  }

  /* Data Row */
  .data-row .table-cell {
    font-size: var(--font-size-content);
  }

  /* Column Widths */
  .item-cell {
    flex: 1;
    min-width: 150px;
  }

  .url-cell {
    flex: 1;
    min-width: 200px;
  }

  .preview-cell {
    width: 50px;

    padding: var(--spacing-xs);
    justify-content: center;
    flex-shrink: 0;
  }

  .description-cell {
    flex: 2;
    min-width: 250px;
  }

  .elo-cell {
    width: 80px;
    justify-content: center;
    flex-shrink: 0;
  }

  .actions-cell {
    width: 60px;
    justify-content: center;
    flex-shrink: 0;
  }

  /* Inputs and Textareas */
  .table-cell input,
  .table-cell textarea {
    width: 100%;
    height: 100%;
    padding: var(--spacing-sm);
    border: var(--border);
    border-radius: var(--border-radius-button);
    background: var(--color-white);
    font-family: var(--font-family);
    font-size: var(--font-size-content);
    resize: none;
    overflow: hidden;
    box-sizing: border-box;
  }

  .table-cell textarea {
    line-height: 1.2;
  }

  .table-cell input::placeholder,
  .table-cell textarea::placeholder {
    color: var(--color-text-faded);
  }

  .picture-preview {
    width: 100%;
    /* height: 100%; */
    aspect-ratio: 1 / 1;
    object-fit: cover;
    display: block;
  }

  .delete-item {
    background: var(--color-white);
    border: var(--border-button);
    border-radius: var(--border-radius-button);
    padding: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .delete-item:hover {
    background: var(--color-black);
  }

  .delete-item:hover svg line {
    stroke: var(--color-white);
  }

  /* Add Item Row */
  .add-item-row {
    display: flex;
    align-items: stretch;
    height: var(--cell-height);
    border: var(--border);
    border-top: none;
    margin-left: -1px;
  }

  .add-button-cell {
    display: flex;
    align-items: center;
    width: 100%;
    padding: var(--spacing-xs);
  }

  .add-btn {
    width: 100%;
    height: var(--button-height);
    border: var(--border-button);
    border-radius: var(--border-radius-button);
    background: var(--color-white);
    font-family: var(--font-family);
    font-size: var(--font-size-content);
    cursor: pointer;
  }

  .add-btn:hover {
    background: var(--color-black);
    color: var(--color-white);
  }
</style>
