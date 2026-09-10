import { Router } from "express";
import type { AgentStore } from "../agent-store";

export function createAgentsRouter(store: AgentStore): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(store.getAll());
  });

  router.put("/:id", (req, res) => {
    try {
      const updated = store.update(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "agent not found" });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "invalid update" });
    }
  });

  return router;
}
