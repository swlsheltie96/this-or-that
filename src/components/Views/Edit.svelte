<script>
  import { createEventDispatcher } from "svelte";
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
      for (let row of diffs.removed) {
        await deleteItem(listName, row.name);
      }
      for (let row of diffs.added) {
        await addItem(listName, {
          name: row.name,
          data: {
            picture: row.picture,
            description: row.description,
          },
        });
      }
      for (let row of diffs.updated) {
        await deleteItem(listName, row.name);
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

  function handleInputChange() {
    dirty = true;
  }

  let csvFile = null;
  let csvItems = [];

  function handleFileChange(event) {
    const file = event.target.files[0];
    if (!file) {
      csvFile = null;
      csvItems = [];
      return;
    }

    csvFile = file;

    // Parse CSV
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      csvItems = parseCSV(text);
    };
    reader.readAsText(file);
  }

  function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Check if first line is a header
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('name') || firstLine.includes('picture') || firstLine.includes('description');

    const dataLines = hasHeader ? lines.slice(1) : lines;

    return dataLines.map(line => {
      // Simple CSV parsing (handles quoted fields)
      const fields = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
      const cleanFields = fields.map(f => f.replace(/^"|"$/g, '').trim());

      const item = {
        name: cleanFields[0] || '',
        picture: cleanFields[1] || '',
        description: cleanFields[2] || '',
        elo: 1000
      };

      return item;
    }).filter(item => item.name); // Only include items with names
  }

  function importCSV() {
    if (csvItems.length === 0) return;

    // Append CSV items to existing tableData
    tableData = [...tableData, ...csvItems];
    dirty = true;

    // Clear the CSV input
    csvFile = null;
    csvItems = [];
    document.getElementById('csvFile').value = '';
  }
</script>

<div class="edit-container">
  <!-- Action Buttons -->
  <!-- <div class="action-buttons">
    <button class="clickable delete-btn" on:click={handleDeleteList}> Delete list </button>
    <button
      class="clickable save-btn {dirty || metadataDirty ? 'dirty' : ''}"
      on:click={saveChanges}
    >
      Save
    </button>
  </div> -->

  <!-- Metadata Form -->
  <div class="metadata-form box">
    <div class="form-row">
      <label for="listTitle">Title</label>
      <input
        type="text"
        id="listTitle"
        bind:value={listTitle}
        on:input={() => (metadataDirty = true)}
      />
    </div>
    <div class="form-row">
      <label for="listDescription">Description</label>
      <input
        type="text"
        id="listDescription"
        bind:value={listDescription}
        on:input={() => (metadataDirty = true)}
      />
    </div>
    <div class="form-row">
      <label for="listPrompt">Voting prompt</label>
      <input
        type="text"
        id="listPrompt"
        bind:value={listPrompt}
        on:input={() => (metadataDirty = true)}
      />
    </div>
    <div class="form-row">
      <label for="listAuthor">Author</label>
      <input
        type="text"
        id="listAuthor"
        bind:value={listAuthor}
        on:input={() => (metadataDirty = true)}
      />
    </div>
  </div>

  <!-- CSV Upload -->
  <div class="csv-upload-section box">
    <div class="csv-upload-header">
      <h3>Import Items from CSV</h3>
    </div>
    <div class="csv-upload-controls">
      <input
        type="file"
        id="csvFile"
        accept=".csv"
        on:change={handleFileChange}
      />
      <small class="help-text">
        CSV format: name, picture_url, description (header optional)
      </small>
      {#if csvItems.length > 0}
        <div class="csv-preview">
          <strong>{csvItems.length} items ready to import</strong>
          <button class="clickable import-btn" on:click={importCSV}>
            Import {csvItems.length} items
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Items Table -->

  <div class="items-table box">
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Picture URL</th>
          <th>Description</th>
          <th>Elo</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each tableData as item, index}
          <tr>
            <td>
              <input
                type="text"
                bind:value={item.name}
                on:input={handleInputChange}
                placeholder="Item name"
              />
            </td>
            <td>
              <input
                type="text"
                bind:value={item.picture}
                on:input={handleInputChange}
                placeholder="Image URL"
              />
            </td>
            <td>
              <input
                type="text"
                bind:value={item.description}
                on:input={handleInputChange}
                placeholder="Description"
              />
            </td>
            <td>{item.elo.toFixed(2)}</td>
            <td>
              <button class="delete-item" on:click={() => removeItem(index)}>×</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <button class="clickable add-btn" on:click={addNewItem}> + Add item </button>
  </div>
</div>

<style>
  .metadata-form {
    /* width: 100%; */
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .form-row {
    display: flex;
    align-items: center;
    /* margin-bottom: 1rem; */
    gap: 5px;
  }

  .form-row label {
    width: 10%;
  }

  .form-row input {
    flex: 1;
    padding: 5px;
    border: 1px solid black;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 0.5rem;
    border: 1px solid black;
    text-align: left;
  }

  th {
    /* background: #f5f5f5; */
    /* font-weight: bold; */
    font-weight: normal;
    font-size: 1em;
  }

  td input {
    width: 100%;
    padding: 0.25rem;
    border: none;
    background: transparent;
  }

  .delete-item {
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .add-btn {
    /* float: right; */
    width: 100%;
    margin-top: 5px;
  }

  .csv-upload-section {
    margin-bottom: 1rem;
  }

  .csv-upload-header h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
  }

  .csv-upload-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .csv-upload-controls input[type="file"] {
    padding: 0.25rem;
  }

  .help-text {
    font-size: 0.875rem;
    color: #666;
  }

  .csv-preview {
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: #e6f7ff;
    border-radius: 4px;
    color: #0066cc;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .import-btn {
    padding: 0.5rem 1rem;
  }
</style>
