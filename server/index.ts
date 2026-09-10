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
app.get("/health", (_req, res) => res.json({ ok: true }));

const agentStore = createAgentStore(dataDir);
const issueStore = createIssueStore(dataDir);

const server = app.listen(PORT, () => console.log(`server on :${PORT}`));
const hub = createWsHub(server, agentStore, issueStore);

app.use("/api/agents", createAgentsRouter(agentStore));
app.use("/api/issues", createIssuesRouter(issueStore, hub.broadcast));
