# AgentRift

Pixel-art top-down world (Phaser 3 + Vite client) where 5 simulated AI agents
walk between stations and hold a 4-persona council debate via the Groq API
when unresolved issues cross a threshold. TypeScript everywhere, Express + ws
server, JSON file persistence, shared types in `shared/types.ts`.

## Commands

- `npm run dev:server` — Express + ws server with hot reload (tsx)
- `npm run dev:client` — Vite dev server for the Phaser client
- `npm run build` — production client bundle (`client/dist/`)
- `npm test` — Vitest (server-side logic)

## Rules

- **`server/data/*.json` and `server/data/*.jsonl` are runtime state.** Never
  hand-edit, never commit (gitignored). Only the server writes it.
- **WS messages are always typed `WSEvent` from `shared/types.ts`**, never raw
  objects. Stores emit plain change events; the WS layer (server/ws.ts) maps
  them to `WSEvent`s.
- **Stores are factories** (`createAgentStore` / `createIssueStore`) taking an
  explicit data dir. Tests pass temp dirs and never touch `server/data/`.
- **`shared/config.ts` exports the value `Config`**; the shared type is imported
  there as `Config as AppConfig` — a value and a type of the same name collide
  (TS2395), so alias the type import, never rename the export.
- **No frontend framework.** No React/Next/Vue — plain Phaser 3 + Vite.
- **No database.** JSON files under `server/data/` only.
- Shared client/server types live in `shared/types.ts` — import from there,
  never duplicate.

## Layout

- `client/` — Phaser game, Vite root, single `index.html` entry
  - `client/net` — WebSocket client + HTTP calls to the server
  - `client/render` — display helpers (tiles, stations, agents, council panel)
  - `client/pathfinding` — walk pathfinding
- `server/` — Express REST + ws WebSocket bridge, council engine
  - `server/council` — debate engine (Groq client, personas, debate trigger)
  - `server/routes` — Express routers (agents, issues)
- `server/data/` — runtime JSON persistence (gitignored)
- `shared/` — types shared by client and server
- `tests/` — Vitest tests

## Known design decisions

- **`council:triggered` is latched, not debounced.** It fires once when the
  unresolved count crosses to `>= threshold`, and re-arms only after the count
  drops back below the threshold. The latch lives in `server/council-state.ts`
  and is checked from both edges — issue creation (may trigger) and issue
  resolution (may clear) — so neither edge can bypass it. Agents walk to their
  own council seat (offset from `Config.meetingPoint`, via `councilPointFor` in
  `shared/config.ts`) on trigger and back to their own stations on clear.
- **Agent status on arrival is derived in the agent store, not the route.**
  A write that clears the target has said "I have arrived"; `update()` reads
  the position against the live `Config` and sets `at_council` or `idle`.
  Every writer routes through the store, so the rule cannot be bypassed by one
  caller. See `deriveArrivalStatus` in `server/agent-store.ts`.

## Workflow

- When a prompt explicitly asks for a plan before implementation and says to
  wait for approval, STOP after presenting the plan. Do not implement, even if
  the path seems obvious. The plan review is the point — it catches design
  errors while they are cheap to fix.

## Secrets

Copy `.env.example` to `.env` and set `GROQ_API_KEY` for the council engine.
Never commit `.env`.
