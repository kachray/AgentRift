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

- **`server/data/*.json` is runtime state.** Never hand-edit, never commit
  (gitignored). Only the server writes it.
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

## Secrets

Copy `.env.example` to `.env` and set `GROQ_API_KEY` for the council engine.
Never commit `.env`.
