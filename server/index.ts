import express from "express";
import path from "node:path";
import { createAgentStore } from "./agent-store";
import { createIssueStore } from "./issue-store";
import { createWsHub } from "./ws";
import { createAgentsRouter } from "./routes/agents";
import { createIssuesRouter } from "./routes/issues";

const PORT = Number(process.env.PORT ?? 3000);
const dataDir = path.join(import.meta.dirname, "data");

const app = express();
app.use(express.json());

// The client is served by Vite on a different origin, so its arrival PUT is preflighted.
const ALLOWED_ORIGINS = new Set(["http://localhost:5173"]); // TODO Phase 8: hardcoded localhost — must be config before any deployment.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin"); // the response now varies per origin; without this a cache can serve the wrong one
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const agentStore = createAgentStore(dataDir);
const issueStore = createIssueStore(dataDir);

const server = app.listen(PORT, () => console.log(`server on :${PORT}`));
const hub = createWsHub(server, agentStore, issueStore);

app.use("/api/agents", createAgentsRouter(agentStore));
app.use("/api/issues", createIssuesRouter(issueStore, hub.broadcast));
