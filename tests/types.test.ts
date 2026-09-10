import { describe, it, expect } from "vitest";
import type { Agent, Issue, WSEvent } from "../shared/types";

describe("shared types", () => {
  it("compiles with real shapes", () => {
    const agent: Agent = {
      id: "a1",
      name: "Ada",
      stationId: "lab",
      position: { x: 1, y: 2 },
      status: "idle",
      currentTask: null,
    };
    const issue: Issue = {
      id: "i1",
      title: "Broken pump",
      severity: "high",
      createdAt: "2026-01-01T00:00:00.000Z",
      resolved: false,
      ownerAgentId: null,
    };
    const event: WSEvent = { type: "agent:update", payload: agent };
    expect(event.payload).toBe(agent);
    expect(issue.severity).toBe("high");
    expect(issue.ownerAgentId).toBeNull();
  });
});
