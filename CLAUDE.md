# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This or That is an Elo-based ranking application where users can create lists, add items, and vote on pairs to generate rankings. Built with Bun (backend), SQLite (database), and Svelte (frontend).

## Development Setup

### Running in Development

Two separate processes are required:

1. **Backend server** (Bun on port 3000):
   ```bash
   bun install
   bun --watch server.ts
   ```

2. **Frontend dev server** (Vite on port 3001):
   ```bash
   bun run dev
   ```

The Vite dev server proxies API calls to the backend (see `vite.config.js`), including WebSocket proxying at `/ws`.

### Testing

Run unit tests:
```bash
bun tests/test.ts
```

Run load tests (disables rate limiting):
```bash
BENCHMARK=1 bun --watch server.ts
bun tests/load.ts
```

### Environment Variables

- `PORT`: Backend server port (default: 3000 from config.json)
- `LRU_SIZE`: Rate limit cache size (default: 10000 from config.json)
- `BENCHMARK`: Set to `1` to disable rate limiting for testing
- `MASTER_PASSWORD`: Optional master password that can authenticate to any list. If not set, only list-specific passwords will work.

## Architecture

### Backend (server.ts)

Custom HTTP server using Bun's native server. Key components:

- **Custom Server class**: Manual routing with `get_map`, `post_map`, `delete_map`
- **LRU Cache**: In-memory rate limiting per endpoint and IP (uses `x-forwarded-for`)
- **SQLite Database** (`lists.db`):
  - `lists`: List metadata (name, JSON data blob, hashed password, created_at)
  - `items`: Items in lists (list_id FK, name, JSON data blob)
  - `elo_ratings`: Computed Elo scores (list_name, item_name, rating)
  - `list_votes`: Vote tracking (list_name, user_id, timestamp)
  - `comments`: Per-list chat comments (id, list_name, author, text, timestamp)
  - `suggestions`: User-submitted list suggestions (id, title, description, author, email, created_at)

**Password verification**: Uses Bun's built-in password hashing. Master password (if set via env var) can authenticate to any list.

### WebSocket Architecture

The server maintains live WS connections for real-time features:

```typescript
const connectedClients = new Set<any>();          // all connected WS clients
const listRooms = new Map<string, Set<any>>();     // per-list chat rooms
const wsListMap = new Map<any, string>();          // ws -> listName lookup
```

**Message types**:
- `stats` (server → all): `{ type, online, votesLastHour }` — broadcast after every vote and periodically
- `join` (client → server): `{ type, listName }` — subscribe to a list room; server replies with `history`
- `history` (server → client): `{ type, comments: [...] }` — last 50 comments for the joined list
- `comment` (client → server): `{ type, listName, author, text }` — saved to DB, broadcast to room

Upgrade happens at `/ws`. On `close`, the client is removed from `connectedClients`, its room, and `wsListMap`.

**Scale note**: State is fully in-memory — fine for single-instance Railway deployment. Multi-instance would require Redis pub/sub.

### Frontend (Svelte SPA)

Located in `src/`. Uses manual URL-based routing (NOT svelte-spa-router despite it being installed).

**Main views**:
- `Home.svelte`: List browsing with sorting and preview images
  - Uses flexbox-based table layout (not HTML tables)
  - **Layout structure**:
    - **Title row**: "This or That" header (outside scrollable containers)
    - **Controls wrapper**: Contains controls row, scrolls independently on mobile
    - **Controls row**: CREATE LIST, RANDOM, SORT, S/M/L size buttons
    - **Home container**: Contains table, scrolls independently on mobile
    - **Header row**: DATE, PIC, TITLE, LEN, DESCRIP, PREVIEW, LOOK, ACT columns
  - **Responsive design** (≤740px):
    - Title row stays at viewport width, no scrolling
    - Controls and table scroll horizontally independently
    - VIEW/VOTE columns frozen to right using `position: sticky`
    - Font size reduced to 16px for content and buttons
    - Scrollable columns (TITLE, DESCRIP, PREVIEW) have 200px width, 100px min-width
    - LOOK column has left border to separate from scrolling content
- `EditView.svelte`: Create new lists AND edit existing ones (replaces old CreateView + Edit)
  - **Create flow**: shows instruction row → `createSuccess` state → 2s delay → navigates to vote page
  - **Edit flow**: shows instruction row → `saveSuccess` ("success. closing...") → 2s delay → navigates to vote page
  - **Delete flow**: requires password first (flashes red label if empty), then shows "Are you sure?" inline button, then `deleteInProgress` state ("Deleting... Good bye.") → 2s delay → navigates home
  - **Suggestion mode**: checkbox to submit a list idea without creating it (saves to `suggestions` table via `/suggest-list`)
- `VoteView.svelte`: Elo voting interface with keyboard shortcuts (Arrow keys, 1/2, Space/Enter)
  - **Chat panel**: toggled by "Chat" button in list-name-bar; appears as right-side panel in `view-and-chat` flex row
  - `view-and-chat` wrapper: `display: flex` row containing `view-panel` (all existing vote UI) and `comments-panel` (280px, border-left)
  - Anonymous auto-assigned names (`adj-noun-NNNN` format) stored in localStorage, editable inline in chat header
  - Joins list room via `joinList()` when chat is opened; messages auto-scroll to bottom via `requestAnimationFrame`
  - `onDestroy` cleans up the `chatMessages` subscription
- `TickerTape.svelte`: Scrolling ticker showing recent ranking changes + online stats
  - Right side shows `{$onlineCount} online · {$votesLastHour}/hr` from WS store
  - Layout: `ticker-wrap` with `ticker-overflow` (flex: 1, overflow hidden) + `online-count` (flex-shrink: 0, border-left)
- `Header.svelte`: Shared header component
- `ListView.svelte`: Table-based item display for list detail view

**Routing logic** (App.svelte):
- Checks `window.location.pathname` and URL params
- No proper router library integration despite dependency

**API layer** (`src/lib/api.js`):
- All backend communication
- Cookie-based password caching per list (security concern)
- Custom password prompt via DOM manipulation

**WebSocket store** (`src/lib/ws.js`):
- Svelte writable stores: `onlineCount`, `votesLastHour`, `chatMessages`, `chatName`
- `chatName` auto-persists to localStorage; generated as `adj-noun-NNNN` on first visit
- `connect()` guard: `if (ws && ws.readyState <= WebSocket.OPEN) return` prevents duplicate connections
- `scheduleReconnect()` guard: single `reconnectTimer` prevents exponential reconnect growth (both `onerror` and `onclose` can fire on failure)
- `joinList(listName)`: clears local messages, sends `join` if connected
- `sendComment(listName, author, text)`: sends `comment` message if connected
- Auto-connects on module load (`if (typeof window !== "undefined") connect()`)

### Data Model

Items store arbitrary JSON data in `data` column:
```json
{
  "picture": "url",
  "description": "text"
}
```

List metadata also stored as JSON in `data` column:
```json
{
  "description": "text",
  "prompt": "voting prompt",
  "author": "name",
  "totalVotingTimeSeconds": 123
}
```

### Design System

Centralized design variables in `src/styles/variables.css`:
- **Colors**: `--color-border: #d9d9d9`, `--color-black`, `--color-white`, `--color-text-faded` (50% opacity)
- **Typography**: `--font-family: 'Helvetica'`, `--font-size-header: 10px`, `--font-size-content: 20px`, `--font-size-content-mobile: 16px`
- **Spacing**: `--spacing-xs: 4px`, `--spacing-sm: 5px`, `--spacing-md: 10px`
- **Dimensions**: `--cell-height: 35px`, `--button-height: 26px`
- **Borders**: `--border: 1px solid #d9d9d9`, `--border-button: 1px solid black`, `--border-radius-button: 2px`

All components should use these variables for consistency.

### Mid-Migration State

The codebase is transitioning from vanilla JS to Svelte:
- `/archive/public/`: Original HTML/JS/CSS files (still served at `/archive/public/*`)
- `/public/`: Fonts and legacy entry point
- `/src/`: New Svelte components

## Common Issues

### Routing Confusion

- Manual URL parsing in App.svelte despite `svelte-spa-router` dependency
- Mix of `.html` file references (`/grid.html`, `/vote.html`) that work via SPA routing
- URL changes use `window.history.pushState` directly

### Rate Limiting

Uses `x-forwarded-for` header for IP identification (server.ts:97), which can be spoofed. Consider session-based approach.

### Svelte Reactive Statement Pitfalls

- Do NOT use `tick()` inside a `$:` reactive statement — it triggers extra render cycles and can freeze the browser
- Use `store.subscribe(() => ...)` with `requestAnimationFrame` for DOM side effects after store changes (e.g. scroll-to-bottom)
- WS reconnect logic: guard with a single `reconnectTimer` variable; both `onerror` and `onclose` fire on failed connections, causing exponential growth if unguarded

## Database Schema Notes

- All tables created with `CREATE TABLE IF NOT EXISTS` for idempotent startup migrations
- Manual migration code exists in server.ts for adding `created_at` column to existing `lists` tables
- Item names duplicated between `items` and `elo_ratings` tables (should use FK to items.id)
- No explicit indexes defined (likely needed on foreign keys and list_name)

## Production Deployment

Deployed on Railway (single instance). Backend serves static files from `dist/` after Vite build. WebSocket state is fully in-memory — acceptable for single-instance; would need Redis pub/sub for multi-instance.
