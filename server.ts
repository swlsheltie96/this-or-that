import config from "./config.json";
import { createClient } from "@libsql/client";

const PORT = process.env.PORT || config.port;
const LRU_SIZE = process.env.LRU_SIZE || config.lru_size;
const BENCHMARK = process.env.BENCHMARK || config.benchmark;
const MASTER_PASSWORD = process.env.MASTER_PASSWORD
  ? await Bun.password.hash(process.env.MASTER_PASSWORD)
  : null;

const TURSO_URL = process.env.TURSO_URL || "file:./lists.db";
const TURSO_TOKEN = process.env.TURSO_TOKEN || "";
const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

console.log(`Serving...`);
console.log(`\tPort: ${PORT}`);
console.log(`\tBenchmark mode = ${BENCHMARK}`);
console.log(`\tLRU size = ${LRU_SIZE}`);
console.log(`\tMaster password ${MASTER_PASSWORD ? "set" : "not set"}`);
console.log(`\tDB: ${TURSO_URL}`);

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key) {
    if (this.cache.has(key)) {
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return -1;
  }

  put(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      const lruKey = this.cache.keys().next().value;
      this.cache.delete(lruKey);
    }
    this.cache.set(key, value);
  }
}

async function passwordVerify(password, storedPassword) {
  try {
    const storedResult = await Bun.password.verify(password, storedPassword);
    if (storedResult) return true;
    if (MASTER_PASSWORD) return await Bun.password.verify(password, MASTER_PASSWORD);
  } catch (e) {
    if (MASTER_PASSWORD) {
      try { return await Bun.password.verify(password, MASTER_PASSWORD); } catch (e) {}
    }
  }
  return false;
}

class Server {
  get_map = {};
  post_map = {};
  delete_map = {};
  rate_limit_map = {};

  get(path, callback) { this.get_map[path] = callback; }

  get_static(path, file, content_type) {
    this.get(path, async (req) => new Response(Bun.file(file), {
      headers: new Headers({ "Content-Type": content_type }),
    }));
  }

  post(path, rate_limit, callback) {
    this.post_map[path] = [callback, rate_limit];
    this.rate_limit_map[path] = new LRUCache(LRU_SIZE);
  }

  delete(path, callback) { this.delete_map[path] = callback; }

  check_rate_limit(req, path, rate) {
    const userId = req.headers.has("x-forwarded-for") ? req.headers.get("x-forwarded-for") : 0;
    const map = this.rate_limit_map[path];
    const now = performance.timeOrigin + performance.now();
    if (!BENCHMARK && map.get(userId) >= 0) {
      if (now - map.get(userId) < rate) return true;
    }
    map.put(userId, now);
    return false;
  }

  serve() {
    const self = this;
    Bun.serve({
      port: PORT,
      async fetch(req, server) {
        const url = new URL(req.url);
        if (url.pathname === "/ws") {
          if (server.upgrade(req)) return undefined;
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        switch (req.method) {
          case "GET":
            if (url.pathname in self.get_map) return await self.get_map[url.pathname](req);
            if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/fonts/") || url.pathname === "/favicon.ico") {
              const file = Bun.file(`dist${url.pathname}`);
              if (await file.exists()) return new Response(file);
            }
            return new Response(Bun.file("dist/index.html"), {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          case "POST":
            if (url.pathname in self.post_map) {
              const [callback, rate_limit] = self.post_map[url.pathname];
              if (self.check_rate_limit(req, url.pathname, rate_limit)) return jsonError("Rate limited");
              return await callback(req);
            }
            break;
          case "DELETE":
            if (url.pathname in self.delete_map) return await self.delete_map[url.pathname](req);
            break;
        }
        return new Response("Invalid path or method", { status: 400 });
      },
      websocket: {
        open(ws) {
          connectedClients.add(ws);
          broadcastStats();
        },
        close(ws) {
          connectedClients.delete(ws);
          const listName = wsListMap.get(ws);
          if (listName) {
            listRooms.get(listName)?.delete(ws);
            wsListMap.delete(ws);
          }
          broadcastStats();
        },
        async message(ws, rawMsg) {
          try {
            const msg = JSON.parse(rawMsg.toString());
            if (msg.type === "join") {
              const prev = wsListMap.get(ws);
              if (prev) listRooms.get(prev)?.delete(ws);
              wsListMap.set(ws, msg.listName);
              if (!listRooms.has(msg.listName)) listRooms.set(msg.listName, new Set());
              listRooms.get(msg.listName)!.add(ws);
              const comments = await dbAll(
                "SELECT author, text, timestamp FROM comments WHERE list_name = ? ORDER BY timestamp ASC LIMIT 50",
                [msg.listName]
              );
              ws.send(JSON.stringify({ type: "history", comments }));
            } else if (msg.type === "comment") {
              const { listName, author, text } = msg;
              if (!listName || !text?.trim()) return;
              const timestamp = new Date().toISOString();
              const safeAuthor = (author || "anon").slice(0, 32);
              const safeText = text.trim().slice(0, 500);
              await db.execute({
                sql: "INSERT INTO comments (list_name, author, text, timestamp) VALUES (?, ?, ?, ?)",
                args: [listName, safeAuthor, safeText, timestamp],
              });
              const broadcast = JSON.stringify({ type: "comment", author: safeAuthor, text: safeText, timestamp });
              const room = listRooms.get(listName);
              if (room) for (const client of room) client.send(broadcast);
            }
          } catch (e) {
            console.error("WS message error:", e);
          }
        },
      },
    });
  }
}

const connectedClients = new Set<any>();
const listRooms = new Map<string, Set<any>>();
const wsListMap = new Map<any, string>();

async function broadcastStats() {
  const result = await dbGet("SELECT COUNT(*) as count FROM list_votes WHERE timestamp > datetime('now', '-1 hour')");
  const msg = JSON.stringify({ type: "stats", online: connectedClients.size, votesLastHour: result?.count ?? 0 });
  for (const ws of connectedClients) ws.send(msg);
}

const app = new Server();

app.get_static("/archive/public/index.html", "archive/public/index.html", "text/html; charset=utf-8");
app.get_static("/archive/public/create.html", "archive/public/create.html", "text/html; charset=utf-8");
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
app.get_static("/fonts/Compagnon-Medium.woff2", "public/fonts/Compagnon-Medium.woff2", "font/woff2");
app.get_static("/fonts/Compagnon-Roman.woff2", "public/fonts/Compagnon-Roman.woff2", "font/woff2");
app.get_static("/archive/public/script.js", "archive/public/script.js", "text/javascript");
app.get_static("/archive/public/list.js", "archive/public/list.js", "text/javascript");
app.get_static("/archive/public/grid.js", "archive/public/grid.js", "text/javascript");
app.get_static("/archive/public/api.js", "archive/public/api.js", "text/javascript");

// Init tables
await db.executeMultiple(`
  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    data JSON,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER,
    name TEXT,
    data JSON,
    FOREIGN KEY (list_id) REFERENCES lists (id)
  );
  CREATE TABLE IF NOT EXISTS elo_ratings (
    list_name TEXT,
    item_name TEXT,
    rating REAL,
    PRIMARY KEY (list_name, item_name)
  );
  CREATE TABLE IF NOT EXISTS elo_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_name TEXT,
    item_name TEXT,
    rating REAL,
    vote_number INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_name) REFERENCES lists (name)
  );
  CREATE TABLE IF NOT EXISTS list_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_name TEXT,
    user_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_name) REFERENCES lists (name)
  );
  CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    author TEXT,
    email TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_name TEXT,
    author TEXT,
    text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_name) REFERENCES lists (name)
  );
`);

const K = 32;

function jsonError(msg, error_status = 400) {
  return Response.json({ error: msg }, { status: error_status });
}

function formatTotalTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

async function runQueries(sql, params, successMessage, errorMessage) {
  try {
    await db.batch(sql.map((s, i) => ({ sql: s, args: params[i] })), "write");
    return Response.json({ message: successMessage });
  } catch (error) {
    console.error(error);
    return jsonError(errorMessage);
  }
}

function runQuery(sql, params, successMessage, errorMessage) {
  return runQueries([sql], [params], successMessage, errorMessage);
}

async function dbGet(sql, args = []) {
  const result = await db.execute({ sql, args });
  return result.rows[0] ?? null;
}

async function dbAll(sql, args = []) {
  const result = await db.execute({ sql, args });
  return result.rows;
}

app.post("/create-list", 10000, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const data = body.data;
  const password = await Bun.password.hash(body.password);
  return runQuery(
    "INSERT INTO lists (name, data, password) VALUES (?, ?, ?)",
    [listName, JSON.stringify(data), password],
    `List "${listName}" created successfully.`,
    `Failed to create list "${listName}".`
  );
});

app.post("/check-password", 0, async (req) => {
  const body = await req.json();
  const { listName, password } = body;
  const row = await dbGet("SELECT password FROM lists WHERE name = ?", [listName]);
  if (!row) return jsonError(`List "${listName}" does not exist.`);
  if (await passwordVerify(password, row.password)) return Response.json({ message: "Password is valid." });
  return jsonError("Invalid password for this list.", 401);
});

app.post("/change-password", 0, async (req) => {
  const body = await req.json();
  const { listName, currentPassword, newPassword: newPw } = body;
  const newPassword = await Bun.password.hash(newPw);
  const row = await dbGet("SELECT password FROM lists WHERE name = ?", [listName]);
  if (!row) return jsonError(`List "${listName}" does not exist.`);
  if (!(await passwordVerify(currentPassword, row.password))) return jsonError("Invalid current password.", 401);
  return runQuery("UPDATE lists SET password = ? WHERE name = ?", [newPassword, listName],
    `Password changed.`, `Failed to change password.`);
});

app.post("/update-list-metadata", 0, async (req) => {
  const body = await req.json();
  const { listName, newListName, description, prompt, author, accentColor, password } = body;
  const row = await dbGet("SELECT id, password, data FROM lists WHERE name = ?", [listName]);
  if (!row) return jsonError(`List "${listName}" does not exist.`);
  if (!(await passwordVerify(password, row.password))) return jsonError("Invalid password.", 401);
  const existingData = row.data ? JSON.parse(row.data as string) : {};
  const updatedData = { ...existingData, description, prompt, author, accentColor };
  if (newListName && newListName !== listName) {
    const existing = await dbGet("SELECT id FROM lists WHERE name = ?", [newListName]);
    if (existing) return jsonError(`A list named "${newListName}" already exists.`);
  }
  const finalName = newListName || listName;
  return runQuery("UPDATE lists SET name = ?, data = ? WHERE id = ?",
    [finalName, JSON.stringify(updatedData), row.id],
    `List metadata updated.`, `Failed to update list metadata.`);
});

app.post("/add-item", 0, async (req) => {
  const body = await req.json();
  const { listName, item: newItem, password } = body;
  const row = await dbGet("SELECT id, password FROM lists WHERE name = ?", [listName]);
  if (!row) return jsonError(`List "${listName}" does not exist.`);
  if (!(await passwordVerify(password, row.password))) return jsonError("Invalid password.", 401);
  const existing = await dbGet("SELECT id FROM items WHERE list_id = ? AND name = ?", [row.id, newItem.name]);
  if (existing) return jsonError(`Item "${newItem.name}" already exists.`);
  return runQuery("INSERT INTO items (list_id, name, data) VALUES (?, ?, ?)",
    [row.id, newItem.name, JSON.stringify(newItem.data)],
    `Item added.`, `Failed to add item.`);
});

app.post("/update-item", 0, async (req) => {
  const body = await req.json();
  const { listName, itemName, data: newData, password } = body;
  const row = await dbGet("SELECT id, password FROM lists WHERE name = ?", [listName]);
  if (!row) return jsonError(`List "${listName}" does not exist.`);
  if (!(await passwordVerify(password, row.password))) return jsonError("Invalid password.", 401);
  return runQuery("UPDATE items SET data = ? WHERE list_id = ? AND name = ?",
    [JSON.stringify(newData), row.id, itemName], `Item updated.`, `Failed to update item.`);
});

app.delete("/delete-list", async (req) => {
  const body = await req.json();
  const { listName, password } = body;
  const row = await dbGet("SELECT id, password FROM lists WHERE name = ?", [listName]);
  if (!row) return jsonError(`List "${listName}" does not exist.`);
  if (!(await passwordVerify(password, row.password))) return jsonError("Invalid password.", 401);
  return runQueries(
    ["DELETE FROM items WHERE list_id = ?", "DELETE FROM elo_ratings WHERE list_name = ?",
     "DELETE FROM elo_history WHERE list_name = ?", "DELETE FROM list_votes WHERE list_name = ?",
     "DELETE FROM lists WHERE name = ?"],
    [[row.id], [listName], [listName], [listName], [listName]],
    `List deleted.`, `Failed to delete list.`
  );
});

app.post("/delete-item", 0, async (req) => {
  const body = await req.json();
  const { listName, itemName, password } = body;
  const row = await dbGet("SELECT id, password FROM lists WHERE name = ?", [listName]);
  if (!row) return jsonError(`List "${listName}" does not exist.`);
  if (!(await passwordVerify(password, row.password))) return jsonError("Invalid password.", 401);
  return runQuery("DELETE FROM items WHERE list_id = ? AND name = ?",
    [row.id, itemName], `Item deleted.`, `Failed to delete item.`);
});

app.get("/get-pair", async (req) => {
  const params = new URL(req.url).searchParams;
  if (!params.has("listName")) return jsonError("listName= required");
  const listName = params.get("listName");
  const listRow = await dbGet("SELECT id FROM lists WHERE name = ?", [listName]);
  if (!listRow) return jsonError(`List "${listName}" does not exist.`);
  const items = await dbAll(`
    SELECT items.*, COALESCE(elo_ratings.rating, 1000) as elo
    FROM items
    LEFT JOIN elo_ratings ON items.name = elo_ratings.item_name AND elo_ratings.list_name = ?
    WHERE items.list_id = ?`, [listName, listRow.id]);
  if (items.length < 2) return jsonError(`Not enough items for voting.`);
  const i1 = Math.floor(Math.random() * items.length);
  let i2 = Math.floor(Math.random() * items.length);
  while (i2 === i1) i2 = Math.floor(Math.random() * items.length);
  return Response.json({ item1: items[i1], item2: items[i2] });
});

app.get("/get-list-info", async (req) => {
  const params = new URL(req.url).searchParams;
  if (!params.has("listName")) return jsonError("listName= required");
  const listName = params.get("listName");
  const row = await dbGet(`
    SELECT lists.data,
           (SELECT COUNT(*) FROM list_votes WHERE list_name = ?) AS voteCount,
           (SELECT MAX(timestamp) FROM list_votes WHERE list_name = ?) AS lastVoteTimestamp,
           (SELECT COUNT(*) FROM items WHERE list_id = lists.id) AS itemCount
    FROM lists WHERE name = ?`, [listName, listName, listName]);
  if (!row) return jsonError(`List "${listName}" does not exist.`);
  const listData = JSON.parse(row.data as string);
  listData.voteCount = row.voteCount;
  listData.lastVoteTimestamp = row.lastVoteTimestamp;
  listData.itemCount = row.itemCount;
  listData.totalVotingTimeSeconds = listData.totalVotingTimeSeconds || 0;
  listData.totalVotingTimeFormatted = formatTotalTime(listData.totalVotingTimeSeconds);
  return Response.json({ data: listData });
});

app.get("/get-sorted-list", async (req) => {
  const params = new URL(req.url).searchParams;
  if (!params.has("listName")) return jsonError("listName= required");
  const listName = params.get("listName");
  const listRow = await dbGet("SELECT id FROM lists WHERE name = ?", [listName]);
  if (!listRow) return jsonError(`List "${listName}" does not exist.`);
  const items = await dbAll("SELECT * FROM items WHERE list_id = ?", [listRow.id]);
  const eloRows = await dbAll("SELECT item_name, rating FROM elo_ratings WHERE list_name = ?", [listName]);
  const eloRatings = {};
  eloRows.forEach((r) => { eloRatings[r.item_name as string] = r.rating; });
  const sortedItems = [...items].sort((a, b) =>
    (eloRatings[b.name as string] || 1000) - (eloRatings[a.name as string] || 1000)
  );
  sortedItems.forEach((item) => { (item as any).elo = eloRatings[item.name as string] || 1000; });
  return Response.json({ list: sortedItems });
});

app.post("/vote", 100, async (req) => {
  const body = await req.json();
  const { listName, winner, loser, sessionTime = 0 } = body;

  const [winnerRow, loserRow] = await Promise.all([
    dbGet("SELECT rating FROM elo_ratings WHERE list_name = ? AND item_name = ?", [listName, winner]),
    dbGet("SELECT rating FROM elo_ratings WHERE list_name = ? AND item_name = ?", [listName, loser]),
  ]);
  const winnerRating = winnerRow ? Number(winnerRow.rating) : 1000;
  const loserRating = loserRow ? Number(loserRow.rating) : 1000;

  const winnerExpected = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
  const winnerNewRating = winnerRating + K * (1 - winnerExpected);
  const loserNewRating = loserRating + K * (0 - (1 - winnerExpected));

  const [winnerCountRow, loserCountRow] = await Promise.all([
    dbGet("SELECT COUNT(*) as count FROM elo_history WHERE list_name = ? AND item_name = ?", [listName, winner]),
    dbGet("SELECT COUNT(*) as count FROM elo_history WHERE list_name = ? AND item_name = ?", [listName, loser]),
  ]);
  const winnerVoteCount = Number(winnerCountRow?.count ?? 0);
  const loserVoteCount = Number(loserCountRow?.count ?? 0);

  const userId = req.headers.get("x-forwarded-for") ?? "0";
  const currentTimestamp = new Date().toISOString();

  const listDataRow = await dbGet("SELECT data FROM lists WHERE name = ?", [listName]);
  const listData = listDataRow?.data ? JSON.parse(listDataRow.data as string) : {};
  listData.totalVotingTimeSeconds = (listData.totalVotingTimeSeconds || 0) + Math.round(sessionTime / 1000);

  const res = await runQueries(
    [
      "INSERT OR REPLACE INTO elo_ratings (list_name, item_name, rating) VALUES (?, ?, ?)",
      "INSERT OR REPLACE INTO elo_ratings (list_name, item_name, rating) VALUES (?, ?, ?)",
      "INSERT INTO list_votes (list_name, user_id, timestamp) VALUES (?, ?, ?)",
      "UPDATE lists SET data = ? WHERE name = ?",
      "INSERT INTO elo_history (list_name, item_name, rating, vote_number) VALUES (?, ?, ?, ?)",
      "INSERT INTO elo_history (list_name, item_name, rating, vote_number) VALUES (?, ?, ?, ?)",
    ],
    [
      [listName, winner, winnerNewRating],
      [listName, loser, loserNewRating],
      [listName, userId, currentTimestamp],
      [JSON.stringify(listData), listName],
      [listName, winner, winnerNewRating, winnerVoteCount + 1],
      [listName, loser, loserNewRating, loserVoteCount + 1],
    ],
    `Elo updated.`,
    `Failed to update Elo.`
  );
  broadcastStats();
  return res;
});

app.get("/get-elo-history", async (req) => {
  const url = new URL(req.url);
  const listName = url.searchParams.get("listName");
  const itemName = url.searchParams.get("itemName");
  if (!listName || !itemName) return jsonError("listName and itemName are required.");
  const rows = await dbAll(
    "SELECT vote_number, rating, timestamp FROM elo_history WHERE list_name = ? AND item_name = ? ORDER BY vote_number ASC",
    [listName, itemName]
  );
  return Response.json({ history: rows });
});

app.get("/recent-changes", async (_req) => {
  const rows = await dbAll(`
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
  `);
  return Response.json({ changes: rows });
});

app.get("/get-lists", async (_req) => {
  const lists = await dbAll(`
    SELECT lists.name, lists.data, lists.created_at,
           COUNT(DISTINCT list_votes.id) as vote_count,
           COUNT(DISTINCT items.id) as item_count,
           MAX(list_votes.timestamp) as last_vote_timestamp
    FROM lists
    LEFT JOIN list_votes ON lists.name = list_votes.list_name
    LEFT JOIN items ON lists.id = items.list_id
    GROUP BY lists.name
    ORDER BY vote_count DESC
  `);

  const sortedLists = await Promise.all(lists.map(async (row) => {
    const listData = row.data ? JSON.parse(row.data as string) : {};
    const topItems = await dbAll(`
      SELECT items.name, items.data, COALESCE(elo_ratings.rating, 1000) as rating
      FROM items
      LEFT JOIN elo_ratings ON items.name = elo_ratings.item_name AND elo_ratings.list_name = ?
      WHERE items.list_id = (SELECT id FROM lists WHERE name = ?)
      ORDER BY rating DESC LIMIT 10`, [row.name, row.name]);

    const previewImages = topItems
      .map((item) => { const d = item.data ? JSON.parse(item.data as string) : {}; return d.picture; })
      .filter(Boolean);

    return {
      name: row.name,
      voteCount: row.vote_count,
      itemCount: row.item_count,
      description: listData.description || null,
      createdAt: row.created_at || null,
      lastVoteTimestamp: row.last_vote_timestamp || null,
      totalVotingTimeSeconds: listData.totalVotingTimeSeconds || 0,
      totalVotingTimeFormatted: listData.totalVotingTimeSeconds ? formatTotalTime(listData.totalVotingTimeSeconds) : "0s",
      previewImage: previewImages[0] || null,
      previewImages,
      itemsList: topItems.map((i) => i.name).join(", "),
      accentColor: listData.accentColor || null,
    };
  }));

  return Response.json({ lists: sortedLists });
});

const heartbeatMap = new Map<string, number>();

app.post("/heartbeat", 5000, async (req) => {
  const userId = req.headers.get("x-forwarded-for") ?? "0";
  heartbeatMap.set(userId, Date.now());
  return Response.json({ message: "ok" });
});

app.get("/stats", async (_req) => {
  const result = await dbGet("SELECT COUNT(*) as count FROM list_votes WHERE timestamp > datetime('now', '-1 hour')");
  return Response.json({ onlineUsers: connectedClients.size, votesLastHour: result?.count ?? 0 });
});

app.post("/suggest-list", 5000, async (req) => {
  const { title, description, author, email } = await req.json();
  if (!title) return jsonError("title required");
  await db.execute({
    sql: "INSERT INTO suggestions (title, description, author, email) VALUES (?, ?, ?, ?)",
    args: [title, description || "", author || "", email || ""],
  });
  return Response.json({ ok: true });
});

app.serve();
