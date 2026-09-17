import { Router } from "express";
import type { Agent, WSEvent } from "../../shared/types";
import { Config, councilPointFor } from "../../shared/config";
import type { IssueStore } from "../issue-store";
import type { AgentStore } from "../agent-store";
import type { CouncilState } from "../council-state";

const SEVERITIES = new Set<string>(["low", "medium", "high"]);

export function createIssuesRouter(
  store: IssueStore,
  agentStore: AgentStore,
  council: CouncilState,
  broadcast: (event: WSEvent) => void,
): Router {
  const router = Router();

  /**
   * The one retarget path — both council edges send agents somewhere through it,
   * and only through the agent store's own update. One call per agent, not
   * target-then-status: two calls would emit two agent:update events for a
   * single move.
   */
  function retargetAll(destinationFor: (agent: Agent) => { x: number; y: number } | undefined): void {
    for (const agent of agentStore.getAll()) {
      const dest = destinationFor(agent);
      // Coordinates only. Config's Station carries an id; Agent.target does not.
      if (dest) agentStore.update(agent.id, { target: { x: dest.x, y: dest.y }, status: "walking" });
    }
  }

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
    const { active, changed } = council.notify(unresolvedCount);
    // Only the rising edge moves anyone; a create can't lower the count, so
    // there is no falling edge to handle here.
    if (changed && active) {
      retargetAll((agent) => councilPointFor(agent.stationId));
      broadcast({ type: "council:triggered", payload: { unresolvedCount, threshold: Config.issueThreshold } });
      console.log(`council triggered: ${unresolvedCount} unresolved issues (threshold ${Config.issueThreshold})`);
    }
    res.status(201).json(issue);
  });

  router.put("/:id/resolve", (req, res) => {
    const issue = store.resolve(req.params.id);
    if (!issue) return res.status(404).json({ error: "issue not found" });
    const { active, changed } = council.notify(store.getUnresolvedCount());
    // Falling edge: send everyone home, including anyone still mid-walk to the
    // meeting point. The client restarts the walk from where the sprite is.
    if (changed && !active) {
      retargetAll((agent) => Config.stations.find((s) => s.id === agent.stationId));
      console.log("council cleared: agents returning to their stations");
    }
    res.json(issue);
  });

  return router;
}
