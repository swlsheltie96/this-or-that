import config from "./config.json";
import { Database } from "bun:sqlite";
import { vote } from "./tests/api";

const PORT = process.env.PORT || config.port;
const LRU_SIZE = process.env.LRU_SIZE || config.lru_size;
const BENCHMARK = process.env.BENCHMARK || config.benchmark;
const MASTER_PASSWORD = process.env.MASTER_PASSWORD
  ? await Bun.password.hash(process.env.MASTER_PASSWORD)
  : null;
console.log(`Serving...`);
console.log(`\tPort: ${PORT}`);
console.log(`\tBenchmark mode = ${BENCHMARK}`);
console.log(`\tLRU size = ${LRU_SIZE}`);
console.log(`\tMaster password ${MASTER_PASSWORD ? 'set' : 'not set'}`);

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key) {
    if (this.cache.has(key)) {
      // To implement LRU, we delete and re-insert the key to update its position
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return -1;
  }

  put(key, value) {
    if (this.cache.has(key)) {
      // If the key already exists, update its value and re-insert it
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // If the cache is at capacity, remove the least recently used item (first key in the map)
      const lruKey = this.cache.keys().next().value;
      this.cache.delete(lruKey);
    }
    this.cache.set(key, value);
  }
}

async function passwordVerify(password, storedPassword) {
  try {
    const storedResult = await Bun.password.verify(password, storedPassword);
    if (storedResult) {
      return true;
    }
    // If stored password doesn't match, try master password (if set)
    if (MASTER_PASSWORD) {
      return await Bun.password.verify(password, MASTER_PASSWORD);
    }
  } catch (e) {
    // If there's an error with stored password, try master password (if set)
    if (MASTER_PASSWORD) {
      try {
        return await Bun.password.verify(password, MASTER_PASSWORD);
      } catch (e) {}
    }
  }
  return false;
}

class Server {
  get_map = {};
  post_map = {};
  delete_map = {};
  rate_limit_map = {};

  get(path, callback) {
    this.get_map[path] = callback;
  }

  get_static(path, file, content_type) {
    this.get(path, async (req) => {
      return new Response(Bun.file(file), {
        headers: new Headers({
          "Content-Type": content_type,
        }),
      });
    });
  }

  post(path, rate_limit, callback) {
    this.post_map[path] = [callback, rate_limit];
    this.rate_limit_map[path] = new LRUCache(LRU_SIZE);
  }

  delete(path, callback) {
    this.delete_map[path] = callback;
  }

  check_rate_limit(req, path, rate) {
    const userId = req.headers.has("x-forwarded-for") ? req.headers.get("x-forwarded-for") : 0;
    const map = this.rate_limit_map[path];
    const now = performance.timeOrigin + performance.now();
    if (!BENCHMARK && map.get(userId) >= 0) {
      const diff = now - map.get(userId);
      if (diff < rate) {
        return true;
      }
    }
    map.put(userId, now);
    return false;
  }

  serve() {
    const self = this;
    Bun.serve({
      port: PORT,
      async fetch(req) {
        const url = new URL(req.url);
        switch (req.method) {
          case "GET":
            if (url.pathname in self.get_map) {
              return await self.get_map[url.pathname](req);
            }

            // Serve static assets from dist/
            if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/fonts/") || url.pathname === "/favicon.ico") {
              const file = Bun.file(`dist${url.pathname}`);
              if (await file.exists()) return new Response(file);
            }

            // SPA fallback — serve index.html for all other GET requests
            return new Response(Bun.file("dist/index.html"), {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          case "POST":
            if (url.pathname in self.post_map) {
              const [callback, rate_limit] = self.post_map[url.pathname];
              if (self.check_rate_limit(req, url.pathname, rate_limit)) {
                return jsonError("Rate limited");
              }
              return await callback(req);
            }
            break;
          case "DELETE":
            if (url.pathname in self.delete_map) {
              return await self.delete_map[url.pathname](req);
            }
            break;
        }
        return new Response("Invalid path or method", {
          status: 400,
        });
      },
    });
  }
}

const app = new Server();

// PRODUCTION ONLY: Serve the main Svelte app for all HTML routes (from dist/)
// Commented out for development - Vite dev server handles these routes
// app.get_static("/", "dist/index.html", "text/html; charset=utf-8");
// app.get_static("/index.html", "dist/index.html", "text/html; charset=utf-8");
// app.get_static("/create.html", "dist/index.html", "text/html; charset=utf-8");
// app.get_static("/list.html", "dist/index.html", "text/html; charset=utf-8");
// app.get_static("/grid.html", "dist/index.html", "text/html; charset=utf-8");
// app.get_static("/vote.html", "dist/index.html", "text/html; charset=utf-8");

// Assets will be handled by the modified fetch method below

// PRODUCTION ONLY: Serve vite.svg
// Commented out for development - Vite dev server handles this
// app.get("/vite.svg", async (req) => {
//   return new Response(Bun.file("dist/vite.svg"), {
//     headers: {
//       "Content-Type": "image/svg+xml",
//     },
//   });
// });

// Serve archived original files for fallback
app.get_static(
  "/archive/public/index.html",
  "archive/public/index.html",
  "text/html; charset=utf-8"
);
app.get_static(
  "/archive/public/create.html",
  "archive/public/create.html",
  "text/html; charset=utf-8"
);
app.get_static("/archive/public/list.html", "archive/public/list.html", "text/html; charset=utf-8");
app.get_static("/archive/public/grid.html", "archive/public/grid.html", "text/html; charset=utf-8");
app.get_static("/archive/public/vote.html", "archive/public/vote.html", "text/html; charset=utf-8");
app.get_static("/archive/public/style.css", "archive/public/style.css", "text/css");
app.get_static("/archive/public/list.css", "archive/public/list.css", "text/css");
app.get_static("/archive/public/grid.css", "archive/public/grid.css", "text/css");
app.get_static("/archive/public/vote.css", "archive/public/vote.css", "text/css");
app.get_static("/archive/public/create.css", "archive/public/create.css", "text/css");

app.get_static("/fonts/Compagnon-Bold.woff", "public/fonts/Compagnon-Bold.woff", "font/woff");
app.get_static("/fonts/Compagnon-Medium.woff", "public/fonts/Compagnon-Medium.woff", "font/woff");
app.get_static("/fonts/Compagnon-Roman.woff", "public/fonts/Compagnon-Roman.woff", "font/woff");
app.get_static("/fonts/Helvetica.woff", "public/fonts/Helvetica.woff", "font/woff");
app.get_static("/fonts/Helvetica-Bold.woff", "public/fonts/Helvetica-Bold.woff", "font/woff");
app.get_static("/fonts/Compagnon-Bold.woff2", "public/fonts/Compagnon-Bold.woff2", "font/woff2");
app.get_static(
  "/fonts/Compagnon-Medium.woff2",
  "public/fonts/Compagnon-Medium.woff2",
  "font/woff2"
);
app.get_static("/fonts/Compagnon-Roman.woff2", "public/fonts/Compagnon-Roman.woff2", "font/woff2");

// Serve archived JS files for fallback
app.get_static("/archive/public/script.js", "archive/public/script.js", "text/javascript");
app.get_static("/archive/public/list.js", "archive/public/list.js", "text/javascript");
app.get_static("/archive/public/grid.js", "archive/public/grid.js", "text/javascript");
app.get_static("/archive/public/api.js", "archive/public/api.js", "text/javascript");

const db = new Database("lists.db");

// Create a table for storing lists
db.query(
  `
  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    data JSON, -- Add a column to store JSON data
    password TEXT, -- Add a column to store list passwords
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`
).run();

// Migration: Add created_at column to existing lists table if it doesn't exist
try {
  // Check if the column already exists first
  const checkColumn = db.query("PRAGMA table_info(lists)").all();
  const hasCreatedAt = checkColumn.some((col) => col.name === "created_at");

  if (!hasCreatedAt) {
    // Add the column without default first
    db.query("ALTER TABLE lists ADD COLUMN created_at DATETIME").run();

    // Set a default value for existing rows (use a reasonable past date)
    db.query("UPDATE lists SET created_at = '2024-01-01 00:00:00' WHERE created_at IS NULL").run();
  }
} catch (error) {
  console.log("Migration note:", error.message);
}

// Create a table for storing items with a foreign key reference to the list
db.query(
  `
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER,
    name TEXT,
    data JSON, -- Add a column to store JSON data
    FOREIGN KEY (list_id) REFERENCES lists (id)
  )
`
).run();

// Create a table for storing Elo ratings
db.query(
  `
  CREATE TABLE IF NOT EXISTS elo_ratings (
    list_name TEXT,
    item_name TEXT,
    rating REAL,
    PRIMARY KEY (list_name, item_name)
  )
`
).run();

// Create a table for storing Elo rating history per item
db.query(
  `
  CREATE TABLE IF NOT EXISTS elo_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_name TEXT,
    item_name TEXT,
    rating REAL,
    vote_number INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_name) REFERENCES lists (name)
  )
`
).run();

// Create a table for storing list votes
db.query(
  `
  CREATE TABLE IF NOT EXISTS list_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_name TEXT,
    user_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_name) REFERENCES lists (name)
    -- You can add a foreign key to reference the user table for user_id if needed
  )
`
).run();

// Placeholder Elo ranking parameters (adjust as needed)
const K = 32; // Elo constant, controls rating update magnitude

function jsonError(msg, error_status = 400) {
  return Response.json(
    {
      error: msg,
    },
    {
      status: error_status,
    }
  );
}

// Helper function to format total voting time
function formatTotalTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// Helper function to wrap bun:sqlite queries and handle errors
function runQueries(sql, params, successMessage, errorMessage) {
  try {
    if (sql.length != params.length) {
      throw Error("Invalid input to runQueries");
    }
    const queries = [];
    for (let q of sql) {
      queries.push(db.query(q));
    }
    const transaction = db.transaction((queries, params) => {
      for (let i = 0; i < queries.length; ++i) {
        const result = queries[i].run(params[i]);
      }
    });
    transaction(queries, params);
    return Response.json({
      message: successMessage,
    });
  } catch (error) {
    return jsonError(errorMessage);
  }
}

function runQuery(sql, params, successMessage, errorMessage) {
  return runQueries([sql], [params], successMessage, errorMessage);
}

// Endpoint to create a new list
app.post("/create-list", 10000, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const data = body.data;
  const password = await Bun.password.hash(body.password); // Add password parameter

  const sql = "INSERT INTO lists (name, data, password) VALUES (?, ?, ?)";
  const params = [listName, JSON.stringify(data), password];
  const successMessage = `List "${listName}" created successfully.`;
  const errorMessage = `Failed to create list "${listName}".`;

  return runQuery(sql, params, successMessage, errorMessage);
});

// Endpoint to check the password for a list
app.post("/check-password", 0, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const password = body.password; // Add password parameter

  // Query the database to retrieve the stored password for the given list
  const sqlGetListPassword = "SELECT password FROM lists WHERE name = ?";
  const paramsGetListPassword = [listName];

  const queryGetListPassword = db.query(sqlGetListPassword);
  const resultGetListPassword = queryGetListPassword.get(paramsGetListPassword);

  if (!resultGetListPassword) {
    return jsonError(`List "${listName}" does not exist.`);
  }

  const storedPassword = resultGetListPassword.password;

  // Compare the provided password with the stored password
  if (await passwordVerify(password, storedPassword)) {
    return Response.json({
      message: "Password is valid.",
    });
  } else {
    return jsonError("Invalid password for this list.", 401);
  }
});

// Endpoint to change the password for a list
app.post("/change-password", 0, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const currentPassword = body.currentPassword;
  const newPassword = await Bun.password.hash(body.newPassword);

  // Query the database to retrieve the stored password for the given list
  const sqlGetListPassword = "SELECT password FROM lists WHERE name = ?";
  const paramsGetListPassword = [listName];

  const queryGetListPassword = db.query(sqlGetListPassword);
  const resultGetListPassword = queryGetListPassword.get(paramsGetListPassword);

  if (!resultGetListPassword) {
    return jsonError(`List "${listName}" does not exist.`);
  }

  const storedPassword = resultGetListPassword.password;

  // Compare the provided current password with the stored password
  const isValidPassword = await passwordVerify(currentPassword, storedPassword);
  const isMasterPassword = MASTER_PASSWORD && (await Bun.password.verify(currentPassword, MASTER_PASSWORD));

  if (!isValidPassword && !isMasterPassword) {
    return jsonError("Invalid current password for this list.", 401);
  }

  // Update the password in the 'lists' table
  const sqlUpdatePassword = "UPDATE lists SET password = ? WHERE name = ?";
  const paramsUpdatePassword = [newPassword, listName];

  return runQuery(
    sqlUpdatePassword,
    paramsUpdatePassword,
    `Password for list "${listName}" changed successfully.`,
    `Failed to change password for list "${listName}".`
  );
});

// Endpoint to update list metadata (description, prompt, author)
app.post("/update-list-metadata", 0, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const newListName = body.newListName;
  const description = body.description;
  const prompt = body.prompt;
  const author = body.author;
  const accentColor = body.accentColor;
  const password = body.password;

  const sqlGetList = "SELECT id, password, data FROM lists WHERE name = ?";
  const paramsGetList = [listName];

  const queryGetList = db.query(sqlGetList);
  const resultGetList = queryGetList.get(paramsGetList);
  if (!resultGetList) {
    return jsonError(`List "${listName}" does not exist.`);
  }

  const listId = resultGetList.id;
  const storedPassword = resultGetList.password;
  const existingData = resultGetList.data ? JSON.parse(resultGetList.data) : {};

  // Check if the provided password matches the stored password
  if (!(await passwordVerify(password, storedPassword))) {
    return jsonError("Invalid password for this list.", 401);
  }

  // Update the list data with new metadata
  const updatedData = {
    ...existingData,
    description: description,
    prompt: prompt,
    author: author,
    accentColor: accentColor,
  };

  // If the list name is being changed, check if the new name already exists
  if (newListName && newListName !== listName) {
    const sqlCheckNewName = "SELECT id FROM lists WHERE name = ?";
    const paramsCheckNewName = [newListName];
    const queryCheckNewName = db.query(sqlCheckNewName);
    const resultCheckNewName = queryCheckNewName.get(paramsCheckNewName);

    if (resultCheckNewName) {
      return jsonError(`A list with the name "${newListName}" already exists.`);
    }
  }

  // Update the list
  const finalListName = newListName || listName;
  const sqlUpdateList = "UPDATE lists SET name = ?, data = ? WHERE id = ?";
  const paramsUpdateList = [finalListName, JSON.stringify(updatedData), listId];

  return runQuery(
    sqlUpdateList,
    paramsUpdateList,
    `List metadata updated successfully.`,
    `Failed to update list metadata.`
  );
});

// Endpoint to add items to a list (with uniqueness check)
app.post("/add-item", 0, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const newItem = body.item;
  const password = body.password; // Add password parameter

  const sqlGetListId = "SELECT id, password FROM lists WHERE name = ?";
  const paramsGetListId = [listName];

  const queryGetListId = db.query(sqlGetListId);
  const resultGetListId = queryGetListId.get(paramsGetListId);
  if (!resultGetListId) {
    return jsonError(`List "${listName}" does not exist.`);
  }

  const listId = resultGetListId.id;
  const storedPassword = resultGetListId.password;

  // Check if the provided password matches the stored password
  const isValidPassword = await passwordVerify(password, storedPassword);
  const isMasterPassword = MASTER_PASSWORD && (await Bun.password.verify(password, MASTER_PASSWORD));

  if (!isValidPassword && !isMasterPassword) {
    return jsonError("Invalid password for this list.", 401);
  }

  // Check for existing items with the same name in the 'items' table
  const sqlCheckExistingItem = "SELECT * FROM items WHERE list_id = ? AND name = ?";
  const paramsCheckExistingItem = [listId, newItem.name];

  const queryCheckExistingItem = db.query(sqlCheckExistingItem);
  const resultCheckExistingItem = queryCheckExistingItem.get(paramsCheckExistingItem);

  if (resultCheckExistingItem) {
    return jsonError(`Item "${newItem.name}" already exists in list "${listName}".`);
  }

  // Insert the new item into the 'items' table with JSON data
  const sqlInsertNewItem = "INSERT INTO items (list_id, name, data) VALUES (?, ?, ?)";
  const paramsInsertNewItem = [listId, newItem.name, JSON.stringify(newItem.data)];

  return runQuery(
    sqlInsertNewItem,
    paramsInsertNewItem,
    `Item "${newItem.name}" added to list "${listName}" successfully.`,
    `Failed to add item to list "${listName}".`
  );
});

app.post("/update-item", 0, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const itemName = body.itemName;
  const newData = body.data;
  const password = body.password;

  const sqlGetListId = "SELECT id, password FROM lists WHERE name = ?";
  const resultGetListId = db.query(sqlGetListId).get([listName]);
  if (!resultGetListId) return jsonError(`List "${listName}" does not exist.`);

  const listId = resultGetListId.id;
  const storedPassword = resultGetListId.password;

  const isValidPassword = await passwordVerify(password, storedPassword);
  const isMasterPassword = MASTER_PASSWORD && (await Bun.password.verify(password, MASTER_PASSWORD));
  if (!isValidPassword && !isMasterPassword) return jsonError("Invalid password for this list.", 401);

  const sql = "UPDATE items SET data = ? WHERE list_id = ? AND name = ?";
  return runQuery(sql, [JSON.stringify(newData), listId, itemName], `Item "${itemName}" updated.`, `Failed to update item.`);
});

// Endpoint to delete a list and its associated items
app.delete("/delete-list", async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const password = body.password; // Add password parameter

  const sqlGetListId = "SELECT id, password FROM lists WHERE name = ?";
  const paramsGetListId = [listName];

  const queryGetListId = db.query(sqlGetListId);
  const resultGetListId = queryGetListId.get(paramsGetListId);
  if (!resultGetListId) {
    return jsonError(`List "${listName}" does not exist.`);
  }

  const listId = resultGetListId.id;
  const storedPassword = resultGetListId.password;

  // Check if the provided password matches the stored password
  const isValidPassword = await passwordVerify(password, storedPassword);

  if (!isValidPassword) {
    return jsonError("Invalid password for this list.", 401);
  }

  // Delete the items associated with the list from the 'items' table
  const sqlDeleteItems = "DELETE FROM items WHERE list_id = ?";
  const paramsDeleteItems = [listId];

  try {
    const queryDeleteItems = db.query(sqlDeleteItems);
    queryDeleteItems.run(paramsDeleteItems);
  } catch (error) {
    return jsonError(`Failed to delete items from list "${listName}".`);
  }

  // Delete the Elo ratings for the items from the 'elo_ratings' table
  const sqlDeleteEloRatings = "DELETE FROM elo_ratings WHERE list_name = ?";
  const paramsDeleteEloRatings = [listName];

  try {
    const queryDeleteEloRatings = db.query(sqlDeleteEloRatings);
    queryDeleteEloRatings.run(paramsDeleteEloRatings);
  } catch (error) {
    return jsonError(`Failed to delete Elo ratings for list "${listName}".`);
  }

  // Delete the Elo history for the list
  try {
    db.query("DELETE FROM elo_history WHERE list_name = ?").run([listName]);
  } catch (error) {
    return jsonError(`Failed to delete Elo history for list "${listName}".`);
  }

  // Delete the list from the 'lists' table
  const sqlDeleteList = "DELETE FROM lists WHERE name = ?";
  const paramsDeleteList = [listName];

  return runQuery(
    sqlDeleteList,
    paramsDeleteList,
    `List "${listName}" and its items deleted successfully.`,
    `Failed to delete list "${listName}".`
  );
});

app.post("/delete-item", 0, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const itemName = body.itemName;
  const password = body.password; // Add password parameter

  const sqlGetListId = "SELECT id, password FROM lists WHERE name = ?";
  const paramsGetListId = [listName];

  try {
    const queryGetListId = db.query(sqlGetListId);
    const resultGetListId = queryGetListId.get(paramsGetListId);
    if (!resultGetListId) {
      return jsonError(`List "${listName}" does not exist.`);
    }

    const listId = resultGetListId.id;
    const storedPassword = resultGetListId.password;

    // Check if the provided password matches the stored password
    const isValidPassword = await passwordVerify(password, storedPassword);
    const isMasterPassword = MASTER_PASSWORD && (await Bun.password.verify(password, MASTER_PASSWORD));

    if (!isValidPassword && !isMasterPassword) {
      return jsonError("Invalid password for this list.", 401);
    }

    // Delete the item from the 'items' table
    const sqlDeleteItem = "DELETE FROM items WHERE list_id = ? AND name = ?";
    const paramsDeleteItem = [listId, itemName];

    return runQuery(
      sqlDeleteItem,
      paramsDeleteItem,
      `Item "${itemName}" deleted from list "${listName}" successfully.`,
      `Failed to delete item "${itemName}" from list "${listName}".`
    );
  } catch (error) {
    return jsonError(`Failed to fetch list ID for list "${listName}".`);
  }
});

// Endpoint to get a random pair of items for voting
app.get("/get-pair", (req) => {
  const params = new URL(req.url).searchParams;
  if (!params.has("listName")) {
    return jsonError(`Invalid query, listName= required`);
  }
  const listName = params.get("listName");

  const sqlGetListId = "SELECT id FROM lists WHERE name = ?";
  const paramsGetListId = [listName];

  try {
    const queryGetListId = db.query(sqlGetListId);
    const resultGetListId = queryGetListId.get(paramsGetListId);
    if (!resultGetListId) {
      return jsonError(`List "${listName}" does not exist.`);
    }

    const listId = resultGetListId.id;

    // Fetch items with their current Elo ratings
    const sqlGetItems = `
      SELECT items.*, COALESCE(elo_ratings.rating, 1000) as elo
      FROM items
      LEFT JOIN elo_ratings ON items.name = elo_ratings.item_name AND elo_ratings.list_name = ?
      WHERE items.list_id = ?`;
    const paramsGetItems = [listName, listId];

    try {
      const queryGetItems = db.query(sqlGetItems);
      const resultsGetItems = queryGetItems.all(paramsGetItems);

      if (resultsGetItems.length >= 2) {
        const randomIndex1 = Math.floor(Math.random() * resultsGetItems.length);
        let randomIndex2 = Math.floor(Math.random() * resultsGetItems.length);

        while (randomIndex2 === randomIndex1) {
          randomIndex2 = Math.floor(Math.random() * resultsGetItems.length);
        }

        const item1 = resultsGetItems[randomIndex1];
        const item2 = resultsGetItems[randomIndex2];

        return Response.json({
          item1,
          item2,
        });
      } else {
        return jsonError(`Not enough items in list "${listName}" for voting.`);
      }
    } catch (error) {
      return jsonError(`Failed to retrieve items from list "${listName}".`);
    }
  } catch (error) {
    return jsonError(`Failed to fetch list ID for list "${listName}".`);
  }
});

// Endpoint to get list metadata
app.get("/get-list-info", (req) => {
  const params = new URL(req.url).searchParams;
  if (!params.has("listName")) {
    return jsonError(`Invalid query, listName= required`);
  }
  const listName = params.get("listName");

  const sqlGetListData = `
    SELECT lists.data,
           (SELECT COUNT(*) FROM list_votes WHERE list_name = ?) AS voteCount,
           (SELECT MAX(timestamp) FROM list_votes WHERE list_name = ?) AS lastVoteTimestamp,
           (SELECT COUNT(*) FROM items WHERE list_id = lists.id) AS itemCount
    FROM lists
    WHERE name = ?`;
  const paramsGetListData = [listName, listName, listName];

  const queryGetListData = db.query(sqlGetListData);
  const resultGetListData = queryGetListData.get(paramsGetListData);
  if (!resultGetListData) {
    return jsonError(`List "${listName}" does not exist.`);
  }

  const listData = JSON.parse(resultGetListData.data);
  const voteCount = resultGetListData.voteCount;
  const lastVoteTimestamp = resultGetListData.lastVoteTimestamp;

  listData.voteCount = voteCount;
  listData.lastVoteTimestamp = lastVoteTimestamp;
  listData.itemCount = resultGetListData.itemCount;

  // Add formatted total voting time
  if (listData.totalVotingTimeSeconds) {
    listData.totalVotingTimeFormatted = formatTotalTime(listData.totalVotingTimeSeconds);
  } else {
    listData.totalVotingTimeSeconds = 0;
    listData.totalVotingTimeFormatted = "0s";
  }

  return Response.json({ data: listData });
});

// Endpoint to get items in a list sorted by Elo rating
app.get("/get-sorted-list", (req) => {
  const params = new URL(req.url).searchParams;
  if (!params.has("listName")) {
    return jsonError(`Invalid query, listName= required`);
  }
  const listName = params.get("listName");

  const sqlGetListId = "SELECT id FROM lists WHERE name = ?";
  const paramsGetListId = [listName];

  const queryGetListId = db.query(sqlGetListId);
  const resultGetListId = queryGetListId.get(paramsGetListId);
  if (!resultGetListId) {
    return jsonError(`List "${listName}" does not exist.`);
  }

  const listId = resultGetListId.id;

  // Fetch items associated with the list from the 'items' table
  const sqlGetItems = "SELECT * FROM items WHERE list_id = ?";
  const paramsGetItems = [listId];

  const queryGetItems = db.query(sqlGetItems);
  const resultsGetItems = queryGetItems.all(paramsGetItems);

  if (!resultsGetItems) {
    return jsonError(`Failed to retrieve items from list "${listName}".`);
  }

  // Fetch Elo ratings for items from the 'elo_ratings' table
  const sqlGetEloRatings = "SELECT item_name, rating FROM elo_ratings WHERE list_name = ?";
  const paramsGetEloRatings = [listName];

  const queryGetEloRatings = db.query(sqlGetEloRatings);
  const eloRows = queryGetEloRatings.all(paramsGetEloRatings);
  if (!eloRows) {
    return jsonError(`Failed to fetch Elo ratings for list "${listName}".`);
  }

  const eloRatings = {};
  eloRows.forEach((row) => {
    eloRatings[row.item_name] = row.rating;
  });

  // Sort items based on Elo ratings
  const sortedItems = resultsGetItems.slice().sort((itemA, itemB) => {
    const ratingA = eloRatings[itemA.name] || 1000; // Default rating if not available
    const ratingB = eloRatings[itemB.name] || 1000;
    return ratingB - ratingA; // Sort in descending order
  });

  sortedItems.forEach((item) => {
    item.elo = eloRatings[item.name] || 1000;
  });

  return Response.json({
    list: sortedItems,
  });
});

app.post("/vote", 100, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const winner = body.winner; // Winner item from the pair
  const loser = body.loser; // Loser item from the pair
  const sessionTime = body.sessionTime || 0; // Time spent in current session (milliseconds)

  const sqlGetWinnerRating = "SELECT rating FROM elo_ratings WHERE list_name = ? AND item_name = ?";
  const paramsGetWinnerRating = [listName, winner];

  const queryGetWinnerRating = db.query(sqlGetWinnerRating);
  const resultGetWinnerRating = queryGetWinnerRating.get(paramsGetWinnerRating);
  const winnerRating = resultGetWinnerRating ? resultGetWinnerRating.rating : 1000; // Default rating if not available

  const sqlGetLoserRating = "SELECT rating FROM elo_ratings WHERE list_name = ? AND item_name = ?";
  const paramsGetLoserRating = [listName, loser];

  const queryGetLoserRating = db.query(sqlGetLoserRating);
  const resultGetLoserRating = queryGetLoserRating.get(paramsGetLoserRating);
  const loserRating = resultGetLoserRating ? resultGetLoserRating.rating : 1000;

  // Calculate Elo updates
  const winnerExpected = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
  const loserExpected = 1 - winnerExpected;

  const winnerNewRating = winnerRating + K * (1 - winnerExpected);
  const loserNewRating = loserRating + K * (0 - loserExpected);

  // Update or insert Elo ratings in the database
  const sqlUpdateWinnerRating =
    "INSERT OR REPLACE INTO elo_ratings (list_name, item_name, rating) VALUES (?, ?, ?)";
  const paramsUpdateWinnerRating = [listName, winner, winnerNewRating];

  const sqlUpdateLoserRating =
    "INSERT OR REPLACE INTO elo_ratings (list_name, item_name, rating) VALUES (?, ?, ?)";
  const paramsUpdateLoserRating = [listName, loser, loserNewRating];

  // Record history for winner and loser
  const sqlGetWinnerVoteCount = "SELECT COUNT(*) as count FROM elo_history WHERE list_name = ? AND item_name = ?";
  const winnerVoteCount = (db.query(sqlGetWinnerVoteCount).get([listName, winner]) as any)?.count ?? 0;
  const loserVoteCount = (db.query(sqlGetWinnerVoteCount).get([listName, loser]) as any)?.count ?? 0;

  const sqlInsertHistory = "INSERT INTO elo_history (list_name, item_name, rating, vote_number) VALUES (?, ?, ?, ?)";
  const paramsWinnerHistory = [listName, winner, winnerNewRating, winnerVoteCount + 1];
  const paramsLoserHistory = [listName, loser, loserNewRating, loserVoteCount + 1];

  const userId = req.headers.has("x-forwarded-for") ? req.headers.get("x-forwarded-for") : 0;

  const currentTimestamp = new Date().toISOString();

  const sqlInsertVote = "INSERT INTO list_votes (list_name, user_id, timestamp) VALUES (?, ?, ?)";
  const paramsInsertVote = [listName, userId, currentTimestamp];

  // Update total voting time in list metadata
  const sqlGetListData = "SELECT data FROM lists WHERE name = ?";
  const queryGetListData = db.query(sqlGetListData);
  const resultGetListData = queryGetListData.get([listName]);

  if (resultGetListData) {
    const listData = resultGetListData.data ? JSON.parse(resultGetListData.data) : {};

    // Add session time to total voting time (convert ms to seconds for storage)
    if (!listData.totalVotingTimeSeconds) {
      listData.totalVotingTimeSeconds = 0;
    }
    listData.totalVotingTimeSeconds += Math.round(sessionTime / 1000);

    const sqlUpdateListData = "UPDATE lists SET data = ? WHERE name = ?";
    const paramsUpdateListData = [JSON.stringify(listData), listName];

    return runQueries(
      [sqlUpdateWinnerRating, sqlUpdateLoserRating, sqlInsertVote, sqlUpdateListData, sqlInsertHistory, sqlInsertHistory],
      [paramsUpdateWinnerRating, paramsUpdateLoserRating, paramsInsertVote, paramsUpdateListData, paramsWinnerHistory, paramsLoserHistory],
      `Elo for "${winner}" and "${loser}" updated successfully.`,
      `Failed to update Elo for "${winner}" and "${loser}".`
    );
  } else {
    return runQueries(
      [sqlUpdateWinnerRating, sqlUpdateLoserRating, sqlInsertVote, sqlInsertHistory, sqlInsertHistory],
      [paramsUpdateWinnerRating, paramsUpdateLoserRating, paramsInsertVote, paramsWinnerHistory, paramsLoserHistory],
      `Elo for "${winner}" and "${loser}" updated successfully.`,
      `Failed to update Elo for "${winner}" and "${loser}".`
    );
  }
});

// Endpoint to get Elo rating history for an item
app.get("/get-elo-history", (req) => {
  const url = new URL(req.url);
  const listName = url.searchParams.get("listName");
  const itemName = url.searchParams.get("itemName");

  if (!listName || !itemName) {
    return jsonError("listName and itemName are required.");
  }

  const rows = db.query(
    "SELECT vote_number, rating, timestamp FROM elo_history WHERE list_name = ? AND item_name = ? ORDER BY vote_number ASC"
  ).all([listName, itemName]);

  return Response.json({ history: rows });
});

// Recent Elo deltas across all lists — used by the ticker tape
app.get("/recent-changes", (req) => {
  const rows = db.query(`
    SELECT h1.list_name, h1.item_name,
           ROUND(h1.rating - h2.rating) AS delta,
           h1.timestamp
    FROM elo_history h1
    JOIN elo_history h2
      ON h1.list_name = h2.list_name
     AND h1.item_name = h2.item_name
     AND h1.vote_number = h2.vote_number + 1
    ORDER BY h1.timestamp DESC
    LIMIT 40
  `).all([]);
  return Response.json({ changes: rows || [] });
});

// Endpoint to get the names of all available lists
app.get("/get-lists", (req) => {
  const sqlGetLists = `
    SELECT lists.name, lists.data, lists.created_at, COUNT(DISTINCT list_votes.id) as vote_count, COUNT(DISTINCT items.id) as item_count,
           MAX(list_votes.timestamp) as last_vote_timestamp
    FROM lists
    LEFT JOIN list_votes ON lists.name = list_votes.list_name
    LEFT JOIN items ON lists.id = items.list_id
    GROUP BY lists.name
    ORDER BY vote_count DESC
  `;

  const queryGetLists = db.query(sqlGetLists);
  const resultsGetLists = queryGetLists.all([]);
  if (!resultsGetLists) {
    return jsonError("Failed to fetch list names.");
  }

  // For each list, fetch the top-ranked item and first 10 items for preview
  const sortedLists = resultsGetLists.map((row) => {
    const listData = row.data ? JSON.parse(row.data) : {};

    // Get top item by Elo rating for preview image
    const sqlGetTopItem = `
      SELECT items.name, items.data, COALESCE(elo_ratings.rating, 1000) as rating
      FROM items
      LEFT JOIN elo_ratings ON items.name = elo_ratings.item_name AND elo_ratings.list_name = ?
      WHERE items.list_id = (SELECT id FROM lists WHERE name = ?)
      ORDER BY rating DESC
      LIMIT 10
    `;
    const queryGetTopItem = db.query(sqlGetTopItem);
    const topItems = queryGetTopItem.all([row.name, row.name]);

    let previewImage = null;
    let previewImages = [];
    let itemsList = "No items";

    if (topItems && topItems.length > 0) {
      // Get preview images from top items
      for (const item of topItems) {
        const itemData = item.data ? JSON.parse(item.data) : {};
        if (itemData.picture) {
          previewImages.push(itemData.picture);
        }
      }
      previewImage = previewImages.length > 0 ? previewImages[0] : null;

      // Get first 10 item names for preview
      itemsList = topItems.map(item => item.name).join(", ");
    }

    return {
      name: row.name,
      voteCount: row.vote_count,
      itemCount: row.item_count,
      description: listData.description || null,
      createdAt: row.created_at || null,
      lastVoteTimestamp: row.last_vote_timestamp || null,
      totalVotingTimeSeconds: listData.totalVotingTimeSeconds || 0,
      totalVotingTimeFormatted: listData.totalVotingTimeSeconds
        ? formatTotalTime(listData.totalVotingTimeSeconds)
        : "0s",
      previewImage: previewImage,
      previewImages: previewImages,
      itemsList: itemsList,
      accentColor: listData.accentColor || null,
    };
  });

  return Response.json({
    lists: sortedLists,
  });
});

// In-memory heartbeat tracking: IP -> last seen timestamp
const heartbeatMap = new Map<string, number>();

app.post("/heartbeat", 5000, async (req) => {
  const userId = req.headers.has("x-forwarded-for") ? req.headers.get("x-forwarded-for") : "0";
  heartbeatMap.set(userId, Date.now());
  return Response.json({ message: "ok" });
});

app.get("/stats", (req) => {
  // Prune stale entries and count online users (active in last 5 minutes)
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  let onlineUsers = 0;
  for (const [ip, timestamp] of heartbeatMap) {
    if (timestamp < fiveMinutesAgo) {
      heartbeatMap.delete(ip);
    } else {
      onlineUsers++;
    }
  }

  // Count votes in the last hour
  const sqlVotesLastHour = "SELECT COUNT(*) as count FROM list_votes WHERE timestamp > datetime('now', '-1 hour')";
  const result = db.query(sqlVotesLastHour).get();
  const votesLastHour = result ? result.count : 0;

  return Response.json({ onlineUsers, votesLastHour });
});

app.get_static("/", "public/index.html", "text/html; charset=utf-8");
app.get_static("/index.html", "public/index.html", "text/html; charset=utf-8");

app.serve();
