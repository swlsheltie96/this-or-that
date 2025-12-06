<script>
  import { createList, addItem } from "../lib/api.js";

  let listName = "";
  let author = "";
  let password = "";
  let description = "";
  let votePrompt = "";
  let submitting = false;
  let error = "";
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
        data: {}
      };

      if (cleanFields[1]) {
        item.data.picture = cleanFields[1];
      }
      if (cleanFields[2]) {
        item.data.description = cleanFields[2];
      }

      return item;
    }).filter(item => item.name); // Only include items with names
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) return;

    try {
      submitting = true;
      error = "";

      // Create the list
      const response = await createList(
        listName,
        { description, prompt: votePrompt, author },
        password
      );

      if (response.error) {
        error = response.error;
        submitting = false;
        return;
      }

      // Store password in cookie
      const cookieManager = new CookieManager();
      cookieManager.setCookie(listName, password, {
        expires: new Date(Date.now() + 86400 * 1000),
        path: "/",
      });

      // Add CSV items if provided
      if (csvItems.length > 0) {
        for (const item of csvItems) {
          try {
            await addItem(listName, item);
          } catch (err) {
            console.error(`Failed to add item ${item.name}:`, err);
          }
        }
      }

      // Redirect to edit mode
      window.location.href = `/grid.html?listName=${encodeURIComponent(listName)}&mode=edit`;
    } catch (err) {
      error = err.message || "Failed to create list";
      submitting = false;
    }
  }

  // Simple cookie manager
  class CookieManager {
    setCookie(name, value, options = {}) {
      const { expires, path, domain, secure } = options;
      let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

      if (expires instanceof Date) {
        cookieString += `; expires=${expires.toUTCString()}`;
      }
      if (path) {
        cookieString += `; path=${path}`;
      }
      if (domain) {
        cookieString += `; domain=${domain}`;
      }
      if (secure) {
        cookieString += "; secure";
      }

      document.cookie = cookieString;
    }
  }
</script>

<svelte:head>
  <title>Create New List</title>
</svelte:head>

<div class="create-view-container">
  <div class="top-header">
    <a href="/" class="home-button">Elo Chamber</a>
  </div>

  <div class="flex center top">
    <h1 class="createTop">Create New List</h1>
  </div>

  <button class="clickable cancel-button">
    <a href="/"><p>Cancel</p></a>
  </button>

  <hr />

  <div class="createForm wrapper box">
    <form id="createListForm" on:submit={handleSubmit}>
      <div class="createForm-inner form">
        <div class="data name">
          <label for="listName">Title</label>
          <input type="text" id="listName" bind:value={listName} required />
        </div>

        <div class="data author">
          <label for="author">Author</label>
          <input type="text" id="author" bind:value={author} />
        </div>

        <div class="data password">
          <label for="password">Password</label>
          <input type="text" id="password" bind:value={password} required />
        </div>

        <div class="data description">
          <label for="description">Description</label>
          <input type="text" id="description" bind:value={description} />
        </div>

        <div class="data prompt">
          <label for="prompt">Vote prompt</label>
          <input type="text" id="prompt" bind:value={votePrompt} required />
        </div>

        <div class="data csv-upload">
          <label for="csvFile">Upload items (CSV) - Optional</label>
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
            </div>
          {/if}
        </div>
      </div>

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <div class="actionButtons">
        <button type="submit" class="clickable submit-button" disabled={submitting}>
          <p>{submitting ? "Creating..." : "Create List"}</p>
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .create-view-container {
    max-width: 600px;
    margin: 0 auto;
  }

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

  .flex.center.top {
    display: flex;
    justify-content: center;
    margin-top: 1rem;
  }

  .createTop {
    text-align: center;
  }

  .cancel-button {
    margin-bottom: 1rem;
  }

  hr {
    margin: 1rem 0;
    border: none;
    border-top: 1px solid #ddd;
  }

  .createForm {
    margin-top: 1rem;
  }

  .createForm-inner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .data {
    display: flex;
    flex-direction: column;
  }

  .data label {
    margin-bottom: 0.25rem;
    font-weight: 500;
  }

  .data input {
    padding: 0.5rem;
    font-size: 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .data input[type="file"] {
    padding: 0.25rem;
  }

  .help-text {
    font-size: 0.875rem;
    color: #666;
    margin-top: 0.25rem;
    display: block;
  }

  .csv-preview {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #e6f7ff;
    border-radius: 4px;
    color: #0066cc;
  }

  .error-message {
    color: red;
    padding: 0.5rem;
    margin: 1rem 0;
    background: #ffe6e6;
    border-radius: 4px;
  }

  .actionButtons {
    margin-top: 1.5rem;
  }

  .submit-button {
    margin-right: 0;
    margin-left: auto;
    display: block;
  }

  .submit-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
