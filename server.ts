import config from "./config.json";
import { createClient } from "@libsql/client";
import { Filter as BadWordsFilter } from "bad-words";
import { Resvg } from "@resvg/resvg-js";

const PORT = process.env.PORT || config.port;
const LRU_SIZE = process.env.LRU_SIZE || config.lru_size;
const BENCHMARK = process.env.BENCHMARK || config.benchmark;
const MASTER_PASSWORD = process.env.MASTER_PASSWORD
  ? await Bun.password.hash(process.env.MASTER_PASSWORD)
  : null;

const TURSO_URL = process.env.TURSO_URL || "file:./lists.db";
const TURSO_TOKEN = process.env.TURSO_TOKEN || "";
const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;
const badWords = new BadWordsFilter();
badWords.removeWords('God', 'damn', 'hell', 'sex');

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
        const ua = req.headers.get("user-agent") || "";
        const secFetch = req.headers.get("sec-fetch-mode");
        const isKnownBot = /facebookexternalhit|Twitterbot|Slackbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|Applebot|opengraph|iframely|embedly/i.test(ua);
        const isCrawler = isKnownBot || (!secFetch && !ua.includes("Mozilla"));
        if (isCrawler && url.pathname !== "/og-image") {
          const listName = url.searchParams.get("listName");
          if (listName) {
            const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
            const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
            const origin = `${proto}://${host}`;
            const html = await buildOGHtml(listName, origin);
            if (html) return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
          }
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
              if (!isClean(text) || !isClean(author || "")) return;
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

// Migrations for columns added after initial schema
try { await db.execute({ sql: "ALTER TABLE suggestions ADD COLUMN email TEXT", args: [] }); } catch {}

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

// ── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const URL_RE = /https?:\/\/|www\./i;

function isClean(text: string): boolean {
  if (URL_RE.test(text)) return false;
  try { return !badWords.isProfane(text); } catch { return true; }
}

// ── Admin auth ─────────────────────────────────────────────────────────────

function checkAdminAuth(req: Request): boolean {
  if (!ADMIN_PASSWORD) return false;
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
  const pass = decoded.slice(decoded.indexOf(":") + 1);
  return pass === ADMIN_PASSWORD;
}

function requireAdmin(req: Request): Response | null {
  if (checkAdminAuth(req)) return null;
  return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Admin"' } });
}

// ── OG image generation ────────────────────────────────────────────────────


async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const ct = resp.headers.get("content-type") || "image/jpeg";
    return `data:${ct};base64,${Buffer.from(buf).toString("base64")}`;
  } catch { return null; }
}

async function generateOGImage(_listName: string, item1: any, item2: any): Promise<Buffer> {
  const [b1, b2] = await Promise.all([
    item1.data?.picture ? fetchAsBase64(item1.data.picture) : null,
    item2.data?.picture ? fetchAsBase64(item2.data.picture) : null,
  ]);
  const img1El = b1
    ? `<image href="${b1}" x="40" y="69.8984" width="490.2" height="490.2" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="40" y="69.8984" width="490.2" height="490.2" fill="#d9d9d9"/>`;
  const img2El = b2
    ? `<image href="${b2}" x="669.8" y="69.8984" width="490.2" height="490.2" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="669.8" y="69.8984" width="490.2" height="490.2" fill="#d9d9d9"/>`;
  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0)">
<rect width="1200" height="630" fill="white"/>
${img1El}
${img2El}
<path d="M574.468 288.477C583.332 288.477 589.894 291.325 594.155 297.021C597.482 301.465 599.146 307.15 599.146 314.077C599.146 321.574 597.243 327.806 593.438 332.773C588.971 338.607 582.603 341.523 574.331 341.523C566.606 341.523 560.534 338.971 556.113 333.867C552.171 328.945 550.2 322.725 550.2 315.205C550.2 308.415 551.886 302.604 555.259 297.773C559.588 291.576 565.991 288.477 574.468 288.477ZM575.151 335.439C581.144 335.439 585.474 333.298 588.14 329.014C590.828 324.707 592.173 319.762 592.173 314.18C592.173 308.278 590.623 303.527 587.524 299.927C584.448 296.326 580.233 294.526 574.878 294.526C569.683 294.526 565.444 296.315 562.163 299.893C558.882 303.447 557.241 308.7 557.241 315.649C557.241 321.209 558.643 325.903 561.445 329.731C564.271 333.537 568.84 335.439 575.151 335.439Z" fill="black"/>
<path d="M630.625 312.847C633.815 312.847 636.333 312.209 638.179 310.933C640.047 309.657 640.981 307.355 640.981 304.028C640.981 300.451 639.683 298.013 637.085 296.714C635.695 296.03 633.838 295.688 631.514 295.688H614.902V312.847H630.625ZM608.101 289.844H631.343C635.171 289.844 638.327 290.402 640.811 291.519C645.527 293.66 647.886 297.614 647.886 303.379C647.886 306.387 647.259 308.848 646.006 310.762C644.775 312.676 643.044 314.214 640.811 315.376C642.77 316.174 644.24 317.222 645.22 318.521C646.222 319.819 646.781 321.927 646.895 324.844L647.134 331.577C647.202 333.491 647.362 334.915 647.612 335.85C648.022 337.445 648.752 338.47 649.8 338.926V340.054H641.46C641.232 339.621 641.05 339.062 640.913 338.379C640.776 337.695 640.662 336.374 640.571 334.414L640.161 326.04C640.002 322.759 638.783 320.56 636.504 319.443C635.205 318.828 633.166 318.521 630.386 318.521H614.902V340.054H608.101V289.844Z" fill="black"/>
</g>
<defs>
<clipPath id="clip0">
<rect width="1200" height="630" fill="white"/>
</clipPath>
</defs>
</svg>`;
  const resvg = new Resvg(svg, { fitTo: { mode: "width" as const, value: 1200 } });
  return Buffer.from(resvg.render().asPng());
}

async function buildOGHtml(listName: string, origin: string): Promise<string | null> {
  const [row, listRow] = await Promise.all([
    dbGet("SELECT data FROM lists WHERE name = ?", [listName]),
    dbGet("SELECT id FROM lists WHERE name = ?", [listName]),
  ]);
  if (!row || !listRow) return null;
  const d = row.data ? JSON.parse(row.data as string) : {};
  const items = await dbAll(`
    SELECT items.name, COALESCE(elo_ratings.rating, 1000) as elo
    FROM items LEFT JOIN elo_ratings ON items.name = elo_ratings.item_name AND elo_ratings.list_name = ?
    WHERE items.list_id = ? ORDER BY elo DESC LIMIT 2`, [listName, listRow.id]);
  const itemTitle = items.length >= 2
    ? `${escapeHtml(listName)}: ${escapeHtml(items[0].name as string)} or ${escapeHtml(items[1].name as string)}`
    : escapeHtml(listName);
  const desc = d.description || `Vote on ${listName}`;
  const img = `${origin}/og-image?listName=${encodeURIComponent(listName)}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${itemTitle}</title>
<meta property="og:title" content="${itemTitle}"/>
<meta property="og:description" content="${escapeHtml(desc)}"/>
<meta property="og:image" content="${img}"/><meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/>
<meta property="og:type" content="website"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${itemTitle}"/>
<meta name="twitter:description" content="${escapeHtml(desc)}"/>
<meta name="twitter:image" content="${img}"/>
</head><body></body></html>`;
}

// ── Admin HTML ─────────────────────────────────────────────────────────────

async function buildAdminHtml(): Promise<string> {
  const [lists, comments, suggestions] = await Promise.all([
    dbAll(`SELECT lists.name, COUNT(DISTINCT items.id) as item_count, COUNT(DISTINCT list_votes.id) as vote_count
           FROM lists LEFT JOIN items ON lists.id = items.list_id
           LEFT JOIN list_votes ON lists.name = list_votes.list_name
           GROUP BY lists.name ORDER BY lists.created_at DESC`),
    dbAll(`SELECT id, list_name, author, text, timestamp FROM comments ORDER BY timestamp DESC LIMIT 300`),
    dbAll(`SELECT id, title, author, email, description, timestamp FROM suggestions ORDER BY timestamp DESC`),
  ]);
  const listsRows = lists.map(l =>
    `<tr data-name="${escapeHtml(String(l.name))}">
      <td>${escapeHtml(String(l.name))}</td>
      <td class="meta">${l.item_count} items · ${l.vote_count} votes</td>
      <td><button class="del" onclick="delList(this)">Delete</button></td></tr>`).join("");
  const commentRows = comments.map(c =>
    `<tr data-id="${c.id}">
      <td class="meta">${escapeHtml(String(c.list_name))}</td>
      <td class="meta">${escapeHtml(String(c.author))}</td>
      <td>${escapeHtml(String(c.text))}</td>
      <td class="meta ts">${String(c.timestamp).slice(0,16)}</td>
      <td><button class="del" onclick="delComment(this)">Delete</button></td></tr>`).join("");
  const suggRows = suggestions.map(s =>
    `<tr data-id="${s.id}">
      <td><b>${escapeHtml(String(s.title))}</b></td>
      <td class="meta">${escapeHtml(String(s.author || ""))}${s.email ? " · " + escapeHtml(String(s.email)) : ""}</td>
      <td>${escapeHtml(String(s.description || ""))}</td>
      <td class="meta ts">${String(s.timestamp).slice(0,16)}</td>
      <td><button class="del" onclick="delSugg(this)">Delete</button></td></tr>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:Helvetica,Arial,sans-serif;font-size:13px;padding:24px;color:#000}
h1{font-size:12px;text-transform:uppercase;letter-spacing:2px;margin-bottom:20px}
h2{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#999;margin:24px 0 8px;padding-bottom:6px;border-bottom:1px solid #d9d9d9}
table{width:100%;border-collapse:collapse}td{padding:6px 10px;border-bottom:1px solid #d9d9d9;vertical-align:top}
.meta{color:#999;font-size:11px}.ts{white-space:nowrap}
.del{font-family:inherit;font-size:11px;border:1px solid #cc0000;color:#cc0000;background:white;cursor:pointer;padding:2px 8px;border-radius:2px}
.del:hover{background:#cc0000;color:white}
</style></head><body>
<h1>Admin · This or That</h1>
<h2>Lists (${lists.length})</h2><table><tbody>${listsRows}</tbody></table>
<h2>Comments (${comments.length})</h2><table><tbody>${commentRows}</tbody></table>
<h2>Suggestions (${suggestions.length})</h2><table><tbody>${suggRows}</tbody></table>
<script>
async function post(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.ok;}
function delList(b){const r=b.closest('tr');if(!confirm('Delete "'+r.dataset.name+'"?'))return;post('/admin/delete-list',{name:r.dataset.name}).then(ok=>{if(ok)r.remove()});}
function delComment(b){const r=b.closest('tr');post('/admin/delete-comment',{id:+r.dataset.id}).then(ok=>{if(ok)r.remove()});}
function delSugg(b){const r=b.closest('tr');post('/admin/delete-suggestion',{id:+r.dataset.id}).then(ok=>{if(ok)r.remove()});}
</script></body></html>`;
}

app.post("/create-list", 10000, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const data = body.data;
  if (!isClean(listName)) return jsonError("List name contains inappropriate content.");
  if (data?.description && !isClean(data.description)) return jsonError("Description contains inappropriate content.");
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
  if (!isClean(newItem.name)) return jsonError("Item name contains inappropriate content.");
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

// ── OG image endpoint ──────────────────────────────────────────────────────

const ogImageCache = new Map<string, { buf: Buffer; ts: number }>();
const OG_CACHE_TTL = 60 * 60 * 1000; // 1 hour

app.get("/og-image", async (req) => {
  const listName = new URL(req.url).searchParams.get("listName");
  if (!listName) return jsonError("listName required");
  const listRow = await dbGet("SELECT id FROM lists WHERE name = ?", [listName]);
  if (!listRow) return jsonError("List not found", 404);
  const items = await dbAll(`
    SELECT items.name, items.data, COALESCE(elo_ratings.rating, 1000) as elo
    FROM items LEFT JOIN elo_ratings ON items.name = elo_ratings.item_name AND elo_ratings.list_name = ?
    WHERE items.list_id = ? ORDER BY elo DESC LIMIT 2`, [listName, listRow.id]);
  if (items.length < 2) return jsonError("Not enough items");
  const cached = ogImageCache.get(listName);
  if (cached && Date.now() - cached.ts < OG_CACHE_TTL) {
    return new Response(cached.buf, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
  }
  const parse = (item: any) => ({ name: item.name, data: item.data ? JSON.parse(item.data as string) : {} });
  try {
    const png = await generateOGImage(listName, parse(items[0]), parse(items[1]));
    ogImageCache.set(listName, { buf: png, ts: Date.now() });
    return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    console.error("OG image error:", e);
    return jsonError("Failed to generate image", 500);
  }
});

// ── Admin endpoints ────────────────────────────────────────────────────────

app.get("/admin", async (req) => {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  return new Response(await buildAdminHtml(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
});

app.post("/admin/delete-comment", 0, async (req) => {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  const { id } = await req.json();
  await db.execute({ sql: "DELETE FROM comments WHERE id = ?", args: [id] });
  return Response.json({ ok: true });
});

app.post("/admin/delete-list", 0, async (req) => {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  const { name } = await req.json();
  const row = await dbGet("SELECT id FROM lists WHERE name = ?", [name]);
  if (!row) return jsonError("Not found", 404);
  return runQueries(
    ["DELETE FROM items WHERE list_id = ?", "DELETE FROM elo_ratings WHERE list_name = ?",
     "DELETE FROM elo_history WHERE list_name = ?", "DELETE FROM list_votes WHERE list_name = ?",
     "DELETE FROM comments WHERE list_name = ?", "DELETE FROM lists WHERE name = ?"],
    [[row.id], [name], [name], [name], [name], [name]],
    "Deleted", "Failed to delete"
  );
});

app.post("/admin/delete-suggestion", 0, async (req) => {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;
  const { id } = await req.json();
  await db.execute({ sql: "DELETE FROM suggestions WHERE id = ?", args: [id] });
  return Response.json({ ok: true });
});

app.serve();
