import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAgentStore } from "../server/agent-store";
import { Config, councilPointFor } from "../shared/config";

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
      expect(agent.target).toBeNull();
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

  it("update persists a target across reload", () => {
    const dir = tmp();
    const store = createAgentStore(dir);
    store.update("ada", { target: { x: 504, y: 624 } });
    expect(createAgentStore(dir).getById("ada")?.target).toEqual({ x: 504, y: 624 });
  });

  it("update emits the target in the event payload", () => {
    const store = createAgentStore(tmp());
    const seen: unknown[] = [];
    store.events.on("update", (agent: unknown) => seen.push(agent));
    store.update("ada", { target: { x: 100, y: 200 } });
    expect((seen[0] as { target: unknown }).target).toEqual({ x: 100, y: 200 });
  });

  it("update accepts a null target and clears a set one", () => {
    const dir = tmp();
    const store = createAgentStore(dir);
    store.update("ada", { target: { x: 100, y: 200 } });
    store.update("ada", { target: null });
    expect(store.getById("ada")?.target).toBeNull();
    expect(createAgentStore(dir).getById("ada")?.target).toBeNull();
  });

  it("update rejects a target missing y, same as an invalid position", () => {
    const store = createAgentStore(tmp());
    expect(() => store.update("ada", { target: { x: 1 } as never })).toThrow(TypeError);
    expect(() => store.update("ada", { position: { x: 1 } as never })).toThrow(TypeError);
  });

  it("update rejects a position carrying extra keys", () => {
    const store = createAgentStore(tmp());
    expect(() => store.update("ada", { position: { x: 1, y: 2, id: "oops" } as never })).toThrow(TypeError);
  });

  it("update rejects a target carrying extra keys", () => {
    const store = createAgentStore(tmp());
    expect(() => store.update("ada", { target: { x: 1, y: 2, extra: true } as never })).toThrow(TypeError);
  });

  it("update rejects a whole Station object, the mistake that motivated this", () => {
    const store = createAgentStore(tmp());
    expect(() => store.update("ada", { target: Config.meetingPoint as never })).toThrow(TypeError);
  });

  it("update still accepts a bare {x, y}", () => {
    const store = createAgentStore(tmp());
    expect(store.update("ada", { position: { x: 1, y: 2 }, target: { x: 3, y: 4 } })?.target).toEqual({ x: 3, y: 4 });
  });

  it("update rejects non-finite coordinates (they would round-trip to null in JSON)", () => {
    const store = createAgentStore(tmp());
    expect(() => store.update("ada", { position: { x: NaN, y: 2 } as never })).toThrow(TypeError);
    expect(() => store.update("ada", { target: { x: 1, y: Infinity } as never })).toThrow(TypeError);
  });

  it("seeds fresh agents when the existing file is corrupt, instead of throwing", () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, "agents.json"), "{not json");
    const store = createAgentStore(dir);
    expect(store.getAll()).toHaveLength(5);
    // The seed overwrote the corrupt file, so the next boot is clean too.
    expect(createAgentStore(dir).getAll()).toHaveLength(5);
  });

  it("names the mismatch when a station has no seed name, instead of crashing unclearly", () => {
    Config.stations.push({ id: "new-station", x: 0, y: 0 });
    try {
      expect(() => createAgentStore(tmp())).toThrow("seedAgents: no name for station 'new-station'");
    } finally {
      Config.stations.pop();
    }
  });
});

describe("agent-store arrival status", () => {
  // Config's Station carries an id; Agent.target is exactly {x, y}. Strip it,
  // same as the retarget path does.
  const point = ({ x, y }: { x: number; y: number }) => ({ x, y });
  const adaSeat = councilPointFor("lab")!;
  const adaStation = point(Config.stations.find((s) => s.id === "lab")!);

  it("derives at_council when a cleared target lands on the agent's council seat", () => {
    const store = createAgentStore(tmp());
    store.update("ada", { status: "walking", target: adaSeat });
    const arrived = store.update("ada", { position: adaSeat, target: null });
    expect(arrived?.status).toBe("at_council");
  });

  it("does not derive at_council at the bare meeting point — only at the agent's seat", () => {
    const store = createAgentStore(tmp());
    store.update("ada", { status: "thinking" });
    const meeting = point(Config.meetingPoint);
    const updated = store.update("ada", { position: meeting, target: null });
    expect(updated?.status).toBe("thinking");
  });

  it("derives idle when a cleared target lands on the agent's own station", () => {
    const store = createAgentStore(tmp());
    store.update("ada", { status: "walking", target: adaStation });
    const arrived = store.update("ada", { position: adaStation, target: null });
    expect(arrived?.status).toBe("idle");
  });

  it("leaves status untouched when the arrival is somewhere else entirely", () => {
    const store = createAgentStore(tmp());
    store.update("ada", { status: "thinking" });
    const updated = store.update("ada", { position: { x: 5, y: 5 }, target: null });
    expect(updated?.status).toBe("thinking");
  });

  it("never overrides an explicit status", () => {
    const store = createAgentStore(tmp());
    const updated = store.update("ada", { position: adaSeat, target: null, status: "walking" });
    expect(updated?.status).toBe("walking");
  });

  it("derives nothing while a target is still set", () => {
    const store = createAgentStore(tmp());
    store.update("ada", { status: "at_council" });
    const updated = store.update("ada", { position: adaStation, target: adaStation });
    expect(updated?.status).toBe("at_council");
  });

  it("matches a rounded arrival within the epsilon, not just exactly", () => {
    const store = createAgentStore(tmp());
    const updated = store.update("ada", { position: { x: adaSeat.x + 1, y: adaSeat.y }, target: null });
    expect(updated?.status).toBe("at_council");
  });
});
