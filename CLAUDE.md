# AgentRift

Pixel-art top-down world (Phaser 3 + Vite client) where 5 simulated AI agents
walk between stations and hold a 4-persona council debate via the Groq API
when unresolved issues cross a threshold. TypeScript everywhere, Express + ws
server, JSON file persistence, shared types in `shared/types.ts`.

## Commands

- `npm run dev:server` — Express + ws server with hot reload (tsx)
- `npm run dev:client` — Vite dev server for the Phaser client
- `npm test` — Vitest (server-side logic)

## Rules

- **`server/data/*.json` and `server/data/*.jsonl` are runtime state.** Never
  hand-edit, never commit (gitignored). Only the server writes it.
- **WS messages are always typed `WSEvent` from `shared/types.ts`**, never raw
  objects. Stores emit plain change events; the WS layer (server/ws.ts) maps
  them to `WSEvent`s.
- **Stores are factories** (`createAgentStore` / `createIssueStore`) taking an
  explicit data dir. Tests pass temp dirs and never touch `server/data/`.
- **`server/config.ts` exports the value `Config`**; the shared type is imported
  there as `Config as AppConfig` — a value and a type of the same name collide
  (TS2395), so alias the type import, never rename the export.
- **No frontend framework.** No React/Next/Vue — plain Phaser 3 + Vite.
- **No database.** JSON files under `server/data/` only.
- Shared client/server types live in `shared/types.ts` — import from there,
  never duplicate.

## Layout

- `client/` — Phaser game, Vite root, single `index.html` entry
- `server/` — Express REST + ws WebSocket bridge, council engine
- `server/data/` — runtime JSON persistence (gitignored)
- `shared/` — types shared by client and server
- `tests/` — Vitest tests

## Known design decisions

- **`council:triggered` fires on every `POST /api/issues` where the unresolved
  count is >= threshold, not once on crossing.** Accepted for Phase 1 (event +
  log only). Before Phase 5 wires this to real agent movement, decide: latch
  until the count drops below threshold again, or debounce.

## Secrets

Copy `.env.example` to `.env` and set `GROQ_API_KEY` for the council engine.
Never commit `.env`.
