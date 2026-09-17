import type { WSEvent } from "../../shared/types";
import type { AgentStore } from "../agent-store";
import type { IssueStore } from "../issue-store";
import type { CouncilState } from "../council-state";
import { runDebate } from "./engine";

export interface DebateTriggerDeps {
  agentStore: AgentStore;
  issueStore: IssueStore;
  council: CouncilState;
  broadcast: (event: WSEvent) => void;
}

/**
 * The council debates when the agents have actually ARRIVED, not when the latch
 * fires — the latch only starts the walk. Arrival is the agent store's business
 * (see deriveArrivalStatus), so this listens to the store rather than the route.
 */
export function attachDebateTrigger(deps: DebateTriggerDeps): void {
  const { agentStore, issueStore, council, broadcast } = deps;

  async function maybeDebate(): Promise<void> {
    const agents = agentStore.getAll();
    // Length guard first: every() is vacuously true on an empty roster.
    if (agents.length === 0 || !agents.every((agent) => agent.status === "at_council")) return;
    // Checked before claiming, so a half-arrived tick cannot burn the one claim.
    if (!council.claimDebate()) return;

    const transcript = await runDebate(issueStore.getAll(), agents);
    broadcast({ type: "council:debate", payload: transcript });
    console.log(`council debate: ${transcript.length} persona responses`);
  }

  agentStore.events.on("update", () => {
    // A rejected promise in a listener is an unhandled rejection, which kills the
    // process. runDebate never rejects, but broadcasting is still on the path.
    maybeDebate().catch((err) => console.error("debate failed", err));
  });
}
