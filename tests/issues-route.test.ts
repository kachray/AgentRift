import { afterAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import type { WSEvent } from "../shared/types";
import { Config, councilPointFor } from "../shared/config";
import { createIssueStore, type IssueStore } from "../server/issue-store";
import { createAgentStore, type AgentStore } from "../server/agent-store";
import { createCouncilState } from "../server/council-state";
import { createIssuesRouter } from "../server/routes/issues";

const dirs: string[] = [];
const servers: Server[] = [];
afterAll(() => {
  dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
  servers.forEach((server) => server.close());
});

interface Harness {
  base: string;
  broadcast: ReturnType<typeof vi.fn>;
  issueStore: IssueStore;
  agentStore: AgentStore;
}

function startApp(): Harness {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentrift-routes-"));
  dirs.push(dir);
  const issueStore = createIssueStore(dir);
  const agentStore = createAgentStore(dir);
  const council = createCouncilState(Config.issueThreshold);
  const broadcast = vi.fn((event: WSEvent) => {});
  const app = express();
  app.use(express.json());
  app.use("/api/issues", createIssuesRouter(issueStore, agentStore, council, broadcast));
  const server = app.listen(0);
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return { base: `http://localhost:${address.port}`, broadcast, issueStore, agentStore };
}

const post = (base: string, body: object) =>
  fetch(`${base}/api/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const resolve = (base: string, id: string) =>
  fetch(`${base}/api/issues/${id}/resolve`, { method: "PUT" });

/** Every agent pointed at its own council seat, mid-walk. */
function expectAllTargeting(agentStore: AgentStore): void {
  const agents = agentStore.getAll();
  expect(agents).toHaveLength(5);
  for (const agent of agents) {
    expect(agent.target).toEqual(councilPointFor(agent.stationId));
    expect(agent.status).toBe("walking");
  }
  // Spread, not converged: no two agents share a seat.
  expect(new Set(agents.map((a) => `${a.target?.x},${a.target?.y}`)).size).toBe(5);
}

/** Each agent back at whichever station it belongs to, mid-walk. */
function expectAllHeadingHome(agentStore: AgentStore): void {
  const agents = agentStore.getAll();
  expect(agents).toHaveLength(5);
  for (const agent of agents) {
    const station = Config.stations.find((s) => s.id === agent.stationId);
    expect(station).toBeTruthy();
    expect(agent.target).toEqual({ x: station!.x, y: station!.y });
    expect(agent.status).toBe("walking");
  }
}

describe("issues routes", () => {
  it("triggers council exactly once when unresolved count reaches threshold", async () => {
    const { base, broadcast } = startApp();

    expect((await post(base, { title: "Reactor overheating", severity: "high" })).status).toBe(201);
    expect((await post(base, { title: "Pump leak", severity: "low" })).status).toBe(201);
    expect(broadcast).not.toHaveBeenCalled();
    expect((await post(base, { title: "Fuel shortage", severity: "medium" })).status).toBe(201);
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(broadcast.mock.calls[0][0]).toEqual({
      type: "council:triggered",
      payload: { unresolvedCount: 3, threshold: 3 },
    });
  });

  it("rejects issue with missing severity", async () => {
    const { base } = startApp();
    const res = await post(base, { title: "No severity" });
    expect(res.status).toBe(400);
  });

  it("sends all 5 agents to their own council seat on trigger", async () => {
    const { base, agentStore } = startApp();
    for (const severity of ["high", "low", "medium"]) {
      await post(base, { title: "issue", severity });
    }
    expectAllTargeting(agentStore);
  });

  it("does not re-trigger, or re-command agents, on issues filed while active", async () => {
    const { base, agentStore, broadcast } = startApp();
    for (const severity of ["high", "low", "medium", "low"]) {
      await post(base, { title: "issue", severity });
    }
    expect(broadcast).toHaveBeenCalledTimes(1);
    expectAllTargeting(agentStore);
  });

  it("sends every agent back to its own station when the latch clears", async () => {
    const { base, agentStore, issueStore } = startApp();
    // Four issues so two resolves are needed to clear — one resolve is a
    // no-op on the latch, and asserting that is the point.
    for (const severity of ["high", "low", "medium", "low"]) {
      await post(base, { title: "issue", severity });
    }
    const unresolved = issueStore.getAll();
    expect((await resolve(base, unresolved[0].id)).status).toBe(200);
    expectAllTargeting(agentStore);

    expect((await resolve(base, unresolved[1].id)).status).toBe(200);
    expectAllHeadingHome(agentStore);
  });

  it("re-arms after clearing: a later crossing triggers and walks out again", async () => {
    const { base, agentStore, issueStore, broadcast } = startApp();
    for (const severity of ["high", "low", "medium"]) {
      await post(base, { title: "issue", severity });
    }
    for (const issue of issueStore.getAll()) await resolve(base, issue.id);
    expectAllHeadingHome(agentStore);

    for (const severity of ["high", "low", "medium"]) {
      await post(base, { title: "issue again", severity });
    }
    expect(broadcast).toHaveBeenCalledTimes(2);
    expectAllTargeting(agentStore);
  });

  it("retargets an agent home mid-walk when the latch clears", async () => {
    const { base, agentStore, issueStore } = startApp();
    for (const severity of ["high", "low", "medium", "low"]) {
      await post(base, { title: "issue", severity });
    }
    // Still walking: nothing has reported an arrival, so every target is live.
    expectAllTargeting(agentStore);

    const unresolved = issueStore.getAll();
    await resolve(base, unresolved[0].id);
    await resolve(base, unresolved[1].id);

    expectAllHeadingHome(agentStore);
    // Positions are untouched by the retarget — the client walks from where the
    // sprite actually is, so the server must not teleport anyone.
    for (const agent of agentStore.getAll()) {
      const station = Config.stations.find((s) => s.id === agent.stationId)!;
      expect(agent.position).toEqual({ x: station.x, y: station.y });
    }
  });
});
