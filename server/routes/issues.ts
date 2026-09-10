import { Router } from "express";
import type { WSEvent } from "../../shared/types";
import { Config } from "../config";
import type { IssueStore } from "../issue-store";

const SEVERITIES = new Set<string>(["low", "medium", "high"]);

export function createIssuesRouter(store: IssueStore, broadcast: (event: WSEvent) => void): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(store.getAll());
  });

  router.post("/", (req, res) => {
    const { title, severity } = req.body ?? {};
    if (typeof title !== "string" || title.trim() === "" || !SEVERITIES.has(severity)) {
      return res.status(400).json({ error: "title (non-empty string) and severity (low|medium|high) required" });
    }
    const issue = store.create({ title, severity });
    const unresolvedCount = store.getUnresolvedCount();
    if (unresolvedCount >= Config.issueThreshold) {
      broadcast({ type: "council:triggered", payload: { unresolvedCount, threshold: Config.issueThreshold } });
      console.log(`council triggered: ${unresolvedCount} unresolved issues (threshold ${Config.issueThreshold})`);
    }
    res.status(201).json(issue);
  });

  router.put("/:id/resolve", (req, res) => {
    const issue = store.resolve(req.params.id);
    if (!issue) return res.status(404).json({ error: "issue not found" });
    res.json(issue);
  });

  return router;
}
