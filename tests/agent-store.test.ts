import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAgentStore } from "../server/agent-store";

const dirs: string[] = [];
function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentrift-agents-"));
  dirs.push(dir);
  return dir;
}
afterAll(() => dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

describe("agent-store", () => {
  it("seeds 5 idle agents at their stations when no file exists", () => {
    const store = createAgentStore(tmp());
    const agents = store.getAll();
    expect(agents).toHaveLength(5);
    for (const agent of agents) {
      expect(agent.status).toBe("idle");
      expect(agent.currentTask).toBeNull();
      expect(agent.stationId).toBeTruthy();
    }
  });

  it("update persists across reload", () => {
    const dir = tmp();
    const store = createAgentStore(dir);
    store.update("ada", { status: "walking", currentTask: "check the reactor" });
    const reloaded = createAgentStore(dir);
    expect(reloaded.getById("ada")?.status).toBe("walking");
    expect(reloaded.getById("ada")?.currentTask).toBe("check the reactor");
  });

  it("update on unknown id returns undefined", () => {
    const store = createAgentStore(tmp());
    expect(store.update("nope", { status: "idle" })).toBeUndefined();
  });

  it("update rejects invalid status", () => {
    const store = createAgentStore(tmp());
    expect(() => store.update("ada", { status: "flying" as never })).toThrow(TypeError);
  });

  it("update emits update event", () => {
    const store = createAgentStore(tmp());
    const seen: unknown[] = [];
    store.events.on("update", (agent: unknown) => seen.push(agent));
    store.update("ada", { status: "thinking" });
    expect(seen).toHaveLength(1);
    expect((seen[0] as { status: string }).status).toBe("thinking");
  });
});
