# elochamber2

An Elo-based ranking application where users can create lists, add items, and vote on pairs to generate rankings.

## Development

### Setup

```bash
bun install
```

### Running the Application

You need to run **two separate processes** in development:

1. **Backend server** (port 3000):
```bash
bun --watch server.ts
```

2. **Frontend dev server** (port 3001):
```bash
bun run dev
```

The Vite dev server will proxy API calls to the backend.

### Environment Variables

- `MASTER_PASSWORD`: (Optional) Set a master password that can access all lists. If not set, only list-specific passwords will work.
- `PORT`: Backend server port (default: 3000)
- `LRU_SIZE`: Rate limit cache size (default: 10000)
- `BENCHMARK`: Set to `1` to disable rate limiting for testing

Example:
```bash
MASTER_PASSWORD=your_secure_password bun --watch server.ts
```

### Testing

Run unit tests:
```bash
bun tests/test.ts
```

Run load tests (with rate limiting disabled):
```bash
BENCHMARK=1 bun --watch server.ts
bun tests/load.ts
```
