// Use relative URLs - Vite proxy will handle routing to backend
const server = "";

class CookieManager {
  constructor() {
    this.cookieCache = new Map();
    this.loadCookies();
  }

  // Load existing cookies into the cache
  loadCookies() {
    const cookies = document.cookie.split("; ");
    for (const cookie of cookies) {
      const [cookieName, cookieValue] = cookie.split("=");
      this.cookieCache.set(cookieName, decodeURIComponent(cookieValue));
    }
  }

  // Get a cookie by its name from the cache or document.cookie
  getCookie(name) {
    if (this.cookieCache.has(name)) {
      return this.cookieCache.get(name);
    }

    const cookies = document.cookie.split("; ");
    for (const cookie of cookies) {
      const [cookieName, cookieValue] = cookie.split("=");
      if (cookieName === name) {
        const decodedValue = decodeURIComponent(cookieValue);
        this.cookieCache.set(name, decodedValue);
        return decodedValue;
      }
    }

    return null;
  }

  // Set a cookie in the cache and using document.cookie
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

    this.cookieCache.set(name, value);
    document.cookie = cookieString;
  }

  // Delete a cookie from the cache and using document.cookie
  deleteCookie(name) {
    this.cookieCache.delete(name);
    const expirationDate = new Date(0);
    this.setCookie(name, "", { expires: expirationDate });
  }
}

function createCustomPrompt(prompt_text) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "login-overlay";

    const title = document.createElement("div");
    title.className = "text-base login-title";
    title.textContent = prompt_text;

    const form = document.createElement("form");
    form.className = "login";

    const fieldRow = document.createElement("div");
    fieldRow.className = "login-field-row";

    const label = document.createElement("label");
    label.className = "text-base";
    label.textContent = "Password";

    const input = document.createElement("input");
    input.type = "password";
    input.className = "text-base";
    input.required = true;

    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.className = "text-base login-submit";
    submitButton.textContent = "Submit";

    fieldRow.appendChild(label);
    fieldRow.appendChild(input);
    form.appendChild(fieldRow);
    overlay.appendChild(title);
    overlay.appendChild(submitButton);
    overlay.appendChild(form);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      resolve(input.value);
      document.body.removeChild(overlay);
    });

    document.body.appendChild(overlay);
    input.focus();
  });
}

const cookieManager = new CookieManager();
async function login(listName) {
  const password = cookieManager.getCookie(listName);
  if (password) {
    return password;
  }
  let attempts = 0;
  const MAX_ATTEMPTS = 3;
  let possible_pw = await createCustomPrompt("Enter password");
  while (possible_pw && !(await checkPassword(listName, possible_pw))) {
    attempts++;
    if (attempts >= MAX_ATTEMPTS) {
      alert("Too many failed attempts. Please try again later.");
      return "";
    }
    possible_pw = await createCustomPrompt("Enter password (attempt " + (attempts + 1) + "/" + MAX_ATTEMPTS + ")");
  }
  if (possible_pw) {
    cookieManager.setCookie(listName, possible_pw, {
      expires: new Date(Date.now() + 86400 * 1000),
      path: "/",
    });
    return possible_pw;
  }
  return "";
}

// Create a new list with a password
async function createList(listName, listData, password) {
  const response = await fetch(`${server}/create-list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      data: listData,
      password: password,
    }), // Include the password
  });
  const data = await response.json();
  return data;
}

// Check the password for a list
async function checkPassword(listName, password) {
  const response = await fetch(`${server}/check-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      password: password,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    alert("Incorrect password.");
  }
  return response.ok; // Return true if the password is valid, false otherwise
}

// Delete a list and its associated items with a password
async function deleteList(listName) {
  const password = await login(listName);
  const response = await fetch(`${server}/delete-list`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      password: password,
    }), // Include the password
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Add an item to a list with a password
async function addItem(listName, item) {
  const password = await login(listName);
  const response = await fetch(`${server}/add-item`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      item: item,
      password: password,
    }), // Include the password
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Delete an item from a list with a password
async function deleteItem(listName, itemName) {
  const password = await login(listName);
  const response = await fetch(`${server}/delete-item`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      itemName: itemName,
      password: password,
    }), // Include the password
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Get a random pair of items for voting
async function getPairForVoting(listName) {
  const response = await fetch(`${server}/get-pair?listName=${encodeURIComponent(listName)}`);
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Vote on a pair of items
async function vote(listName, winner, loser, sessionTime = 0) {
  const response = await fetch(`${server}/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      winner: winner,
      loser: loser,
      sessionTime: sessionTime,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || response.statusText;
    throw new Error(`Failed to vote: ${errorMessage}`);
  }
  const data = await response.json();
  return data;
}

async function getSortedList(listName) {
  const response = await fetch(
    `${server}/get-sorted-list?listName=${encodeURIComponent(listName)}`
  );
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();

  if (response.ok) {
    return data.list.map((d) => ({
      name: d.name,
      elo: d.elo,
      data: d.data ? JSON.parse(d.data) : {},
    }));
  } else {
    console.error("Error:", data.error);
  }
  return null;
}

async function getListInfo(listName) {
  const response = await fetch(`${server}/get-list-info?listName=${encodeURIComponent(listName)}`);
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  if (response.ok) {
    if (data && data.data) {
      return data.data; // Return the data object directly
    } else {
      console.error("Error:", data.error);
      return null;
    }
  }
}

// Function to test the get-lists endpoint
async function getListsWithPopularity() {
  const response = await fetch(`${server}/get-lists`);
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

// Change the password for a list
async function changePassword(listName, currentPassword, newPassword) {
  const response = await fetch(`${server}/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      currentPassword: currentPassword, // Provide the current password
      newPassword: newPassword, // Provide the new password
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Update an existing item's data
async function updateItem(listName, itemName, data) {
  const password = await login(listName);
  const response = await fetch(`${server}/update-item`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listName, itemName, data, password }),
  });
  if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
  return response.json();
}

// Update list metadata (description, prompt, author, name)
async function updateListMetadata(listName, newListName, description, prompt, author, accentColor, noImages = false) {
  const password = await login(listName);
  const response = await fetch(`${server}/update-list-metadata`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      newListName: newListName,
      description: description,
      prompt: prompt,
      author: author,
      accentColor: accentColor,
      noImages: noImages,
      password: password,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Get Elo rating history for an item
async function getEloHistory(listName, itemName) {
  const response = await fetch(
    `${server}/get-elo-history?listName=${encodeURIComponent(listName)}&itemName=${encodeURIComponent(itemName)}`
  );
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  return await response.json();
}

// Get recent Elo deltas across all lists (for ticker tape)
async function getRecentChanges() {
  const response = await fetch(`${server}/recent-changes`);
  if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
  return await response.json();
}

// Get site-wide stats (online users, votes in last hour)
async function getStats() {
  const response = await fetch(`${server}/stats`);
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  return await response.json();
}

// Send heartbeat to track online presence
async function sendHeartbeat() {
  const response = await fetch(`${server}/heartbeat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  return await response.json();
}

function navigate(url) {
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function getListPassword(listName) {
  return cookieManager.getCookie(listName) || "";
}

function setListPassword(listName, password) {
  if (!password) return;
  cookieManager.setCookie(listName, password, {
    expires: new Date(Date.now() + 86400 * 1000),
    path: "/",
  });
}

// Export all functions for ES modules
export {
  getRecentChanges,
  createList,
  checkPassword,
  deleteList,
  addItem,
  deleteItem,
  getPairForVoting,
  vote,
  getSortedList,
  getListInfo,
  getListsWithPopularity,
  changePassword,
  navigate,
  updateItem,
  updateListMetadata,
  login,
  getStats,
  sendHeartbeat,
  getEloHistory,
  getListPassword,
  setListPassword,
};
