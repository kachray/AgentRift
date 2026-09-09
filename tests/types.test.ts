import { describe, it, expect } from "vitest";
import type { Agent, Issue, WSEvent } from "../shared/types";

describe("shared types", () => {
  it("compiles with placeholder shapes", () => {
    const agent: Agent = { id: "a1", name: "Ada" };
    const issue: Issue = { id: "i1", title: "Broken pump" };
    const event: WSEvent = { type: "agent:update", payload: agent };
    expect(event.payload).toBe(agent);
    expect(issue.id).toBe("i1");
  });
});
